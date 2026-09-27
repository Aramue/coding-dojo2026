import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FluxQuiz,
  REPLI_MS,
  SURETE_MS,
  urlSonnette,
  type OptionsFlux,
  type Photographie,
} from '../../src/quiz/flux'

/** Un WebSocket de théâtre : le test décide quand il s'ouvre, parle ou tombe. */
class FausseSonnette {
  envoyes: string[] = []
  ferme = false
  onopen: (() => void) | null = null
  onmessage: ((evenement: { data: string }) => void) | null = null
  onclose: ((evenement: { code: number }) => void) | null = null

  send(texte: string) {
    this.envoyes.push(texte)
  }
  close() {
    this.ferme = true
  }
  ouvrir() {
    this.onopen?.()
  }
  dire(message: unknown) {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) })
  }
  tomber(code = 1006) {
    this.onclose?.({ code })
  }
}

const T0 = Date.parse('2026-09-30T14:00:00.000Z')

function photo(surcharge: Partial<Photographie> = {}): Photographie {
  return { maintenant: new Date(Date.now()).toISOString(), ...surcharge }
}

function monter(options: Partial<OptionsFlux<Photographie>> = {}) {
  const sonnettes: FausseSonnette[] = []
  const lire = vi.fn(async () => photo())
  const onEtat = vi.fn()
  const onErreur = vi.fn()
  const flux = new FluxQuiz<Photographie>({
    lire,
    presentation: () => ({ jeton: 'DOJO-K7M2.sig' }),
    onEtat,
    onErreur,
    ouvrirSocket: () => {
      const s = new FausseSonnette()
      sonnettes.push(s)
      return s as unknown as WebSocket
    },
    ...options,
  })
  return { flux, sonnettes, lire, onEtat, onErreur }
}

/** Laisse passer les promesses en attente sans faire avancer le temps. */
async function vider() {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FluxQuiz', () => {
  it('lit tout de suite et se présente à la sonnette par le premier message', async () => {
    const { flux, sonnettes, lire, onEtat } = monter()
    flux.demarrer()
    await vider()
    expect(lire).toHaveBeenCalledTimes(1)
    expect(onEtat).toHaveBeenCalledTimes(1)

    sonnettes[0]!.ouvrir()
    expect(JSON.parse(sonnettes[0]!.envoyes[0]!)).toEqual({ jeton: 'DOJO-K7M2.sig' })
    flux.arreter()
  })

  it('sans sonnette, relit chaque seconde', async () => {
    const { flux, lire } = monter()
    flux.demarrer()
    await vider()
    await vi.advanceTimersByTimeAsync(REPLI_MS * 3)
    expect(lire).toHaveBeenCalledTimes(4)
    expect(flux.sonnetteBranchee).toBe(false)
    flux.arreter()
  })

  it('sonnette branchée, relit à chaque sonnerie et toutes les dix secondes par sûreté', async () => {
    const { flux, sonnettes, lire } = monter()
    flux.demarrer()
    await vider()
    sonnettes[0]!.ouvrir()
    sonnettes[0]!.dire({ type: 'pret' })
    await vider()
    expect(flux.sonnetteBranchee).toBe(true)
    const apresPret = lire.mock.calls.length

    await vi.advanceTimersByTimeAsync(REPLI_MS * 5)
    expect(lire).toHaveBeenCalledTimes(apresPret)

    sonnettes[0]!.dire({ type: 'changement' })
    await vider()
    expect(lire).toHaveBeenCalledTimes(apresPret + 1)

    await vi.advanceTimersByTimeAsync(SURETE_MS)
    expect(lire).toHaveBeenCalledTimes(apresPret + 2)
    flux.arreter()
  })

  it('ignore un message illisible ou inconnu', async () => {
    const { flux, sonnettes, lire } = monter()
    flux.demarrer()
    await vider()
    sonnettes[0]!.dire('pas du json')
    sonnettes[0]!.dire({ type: 'autre' })
    sonnettes[0]!.dire(null)
    await vider()
    expect(lire).toHaveBeenCalledTimes(1)
    flux.arreter()
  })

  it('quand la sonnette tombe, retombe sur la relève et la rebranche', async () => {
    const { flux, sonnettes, lire } = monter()
    flux.demarrer()
    await vider()
    sonnettes[0]!.dire({ type: 'pret' })
    await vider()

    sonnettes[0]!.tomber()
    expect(flux.sonnetteBranchee).toBe(false)
    const avant = lire.mock.calls.length
    await vi.advanceTimersByTimeAsync(REPLI_MS)
    expect(lire.mock.calls.length).toBeGreaterThan(avant)
    // Première reconnexion après une seconde.
    expect(sonnettes).toHaveLength(2)
    flux.arreter()
  })

  it('espace les tentatives de reconnexion', async () => {
    const { flux, sonnettes } = monter()
    flux.demarrer()
    await vider()
    sonnettes[0]!.tomber()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sonnettes).toHaveLength(2)
    sonnettes[1]!.tomber()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sonnettes).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sonnettes).toHaveLength(3)
    flux.arreter()
  })

  it('ne rebranche pas une sonnette qui a refusé la présentation', async () => {
    const { flux, sonnettes } = monter()
    flux.demarrer()
    await vider()
    sonnettes[0]!.tomber(4401)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sonnettes).toHaveLength(1)
    flux.arreter()
  })

  it('retente plus tard si le WebSocket ne peut même pas être créé', async () => {
    let essais = 0
    const { flux } = monter({
      ouvrirSocket: () => {
        essais += 1
        throw new Error('bloqué')
      },
    })
    flux.demarrer()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(essais).toBe(2)
    flux.arreter()
  })

  it('relit à l échéance de la question, pour trouver la correction', async () => {
    // Plus courte que la relève de sûreté, pour que seule l'échéance relise.
    const finA = new Date(T0 + 5_000).toISOString()
    const lire = vi.fn(async () => photo({ phase: 'question', question: { fin_a: finA } as never }))
    const { flux, sonnettes } = monter({ lire })
    flux.demarrer()
    await vider()
    sonnettes[0]!.dire({ type: 'pret' })
    await vider()
    const avant = lire.mock.calls.length

    await vi.advanceTimersByTimeAsync(5_000)
    expect(lire).toHaveBeenCalledTimes(avant)
    await vi.advanceTimersByTimeAsync(800)
    expect(lire).toHaveBeenCalledTimes(avant + 1)
    flux.arreter()
  })

  it('relance vite une échéance déjà passée que le serveur ne voit pas encore', async () => {
    const finA = new Date(T0 - 5_000).toISOString()
    const lire = vi.fn(async () => photo({ phase: 'question', question: { fin_a: finA } as never }))
    const { flux, sonnettes } = monter({ lire })
    flux.demarrer()
    await vider()
    sonnettes[0]!.dire({ type: 'pret' })
    await vider()
    const avant = lire.mock.calls.length
    await vi.advanceTimersByTimeAsync(500)
    expect(lire.mock.calls.length).toBeGreaterThan(avant)
    flux.arreter()
  })

  it('ne lance jamais deux relectures en même temps, mais n en perd aucune', async () => {
    let liberer: (() => void) | undefined
    const lire = vi.fn(
      () =>
        new Promise<Photographie>((resoudre) => {
          liberer = () => resoudre(photo())
        }),
    )
    const { flux } = monter({ lire })
    flux.demarrer()
    void flux.relire()
    void flux.relire()
    expect(lire).toHaveBeenCalledTimes(1)

    liberer!()
    await vider()
    // Les deux demandes faites pendant la première n'en donnent qu'une.
    expect(lire).toHaveBeenCalledTimes(2)
    liberer!()
    await vider()
    expect(lire).toHaveBeenCalledTimes(2)
    flux.arreter()
  })

  it('signale une lecture en échec, puis se tait quand elle revient', async () => {
    const lire = vi
      .fn()
      .mockRejectedValueOnce(new Error('La plateforme ne répond pas.'))
      .mockRejectedValueOnce('pas une Error')
      .mockResolvedValue(photo())
    const { flux, onErreur } = monter({ lire })
    flux.demarrer()
    await vider()
    expect(onErreur).toHaveBeenLastCalledWith('La plateforme ne répond pas.')
    await vi.advanceTimersByTimeAsync(REPLI_MS)
    expect(onErreur).toHaveBeenLastCalledWith('La plateforme ne répond pas.')
    await vi.advanceTimersByTimeAsync(REPLI_MS)
    expect(onErreur).toHaveBeenLastCalledWith(null)
    flux.arreter()
  })

  it('transmet l écart d horloge mesuré sur la requête', async () => {
    const lire = vi.fn(async () => ({ maintenant: new Date(T0 + 3_000).toISOString() }))
    const { flux, onEtat } = monter({ lire })
    flux.demarrer()
    await vider()
    expect(onEtat.mock.calls[0]![1]).toBe(3_000)
    flux.arreter()
  })

  it('reçoit une photographie venue d un POST comme une relecture', async () => {
    const { flux, onEtat } = monter()
    flux.demarrer()
    await vider()
    flux.recevoir(photo({ phase: 'attente' }), Date.now())
    expect(onEtat).toHaveBeenCalledTimes(2)
    flux.arreter()
  })

  it('arrêté, ne lit plus, ferme la sonnette et ne la rebranche pas', async () => {
    const { flux, sonnettes, lire, onEtat } = monter()
    flux.demarrer()
    flux.demarrer() // sans effet : déjà démarré
    await vider()
    flux.arreter()
    expect(sonnettes[0]!.ferme).toBe(true)

    sonnettes[0]!.tomber()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(lire).toHaveBeenCalledTimes(1)
    expect(sonnettes).toHaveLength(1)
    await flux.relire()
    expect(onEtat).toHaveBeenCalledTimes(1)
  })

  it('une lecture qui revient après l arrêt ne touche plus à l écran', async () => {
    let liberer: ((etat: Photographie) => void) | undefined
    let echouer: ((erreur: Error) => void) | undefined
    const lire = vi
      .fn()
      .mockImplementationOnce(() => new Promise((ok) => (liberer = ok)))
      .mockImplementationOnce(() => new Promise((_, ko) => (echouer = ko)))
    const { flux, onEtat, onErreur } = monter({ lire })
    flux.demarrer()
    flux.arreter()
    liberer!(photo())
    await vider()
    expect(onEtat).not.toHaveBeenCalled()

    flux.demarrer()
    flux.arreter()
    echouer!(new Error('trop tard'))
    await vider()
    expect(onErreur).not.toHaveBeenCalled()
  })
})

describe('FluxQuiz sans sonnette injectée', () => {
  it('ouvre un vrai WebSocket vers /api/quiz/flux', async () => {
    const ouvertes: string[] = []
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor(url: string) {
          ouvertes.push(url)
        }
        close() {}
      },
    )
    try {
      const flux = new FluxQuiz<Photographie>({
        lire: async () => photo(),
        presentation: () => ({}),
        onEtat: () => {},
        onErreur: () => {},
      })
      flux.demarrer()
      await vider()
      flux.arreter()
      expect(ouvertes).toEqual([`ws://${location.host}/api/quiz/flux`])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('urlSonnette', () => {
  it('suit le protocole de la page et passe par /api', () => {
    expect(urlSonnette({ protocol: 'https:', host: 'dojo.unige.ch' })).toBe(
      'wss://dojo.unige.ch/api/quiz/flux',
    )
    expect(urlSonnette({ protocol: 'http:', host: 'localhost:5173' })).toBe(
      'ws://localhost:5173/api/quiz/flux',
    )
  })

  it('ne met jamais le jeton dans l URL', () => {
    expect(urlSonnette({ protocol: 'http:', host: 'localhost' })).not.toContain('jeton')
  })
})

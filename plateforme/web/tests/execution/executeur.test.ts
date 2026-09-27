import { describe, expect, it, vi } from 'vitest'
import { Executeur } from '../../src/execution/executeur'

/** Faux Worker : répond après `delaiMs`, ou jamais si `delaiMs` est null. */
class WorkerFactice {
  onmessage: ((e: { data: unknown }) => void) | null = null
  termine = false
  constructor(
    private charge: unknown,
    private delaiMs: number | null,
  ) {}
  postMessage(demande: { id: string }) {
    if (this.delaiMs === null) return
    setTimeout(() => this.onmessage?.({ data: { id: demande.id, ok: true, charge: this.charge } }), this.delaiMs)
  }
  terminate() {
    this.termine = true
  }
}

const CHARGE = { stdout: 'Bonjour\n', erreur: null, variables: {} }

describe('Executeur', () => {
  it('renvoie le resultat du worker', async () => {
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 1) as unknown as Worker)
    const r = await ex.executer({ code: 'print("Bonjour")', entrees: [], nomsVariables: [] })
    expect(r.stdout).toBe('Bonjour\n')
    expect(r.timeout).toBe(false)
    expect(r.dureeMs).toBeGreaterThanOrEqual(0)
  })

  it('mesure une duree', async () => {
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 5) as unknown as Worker)
    const r = await ex.executer({ code: 'x = 1', entrees: [], nomsVariables: [] })
    expect(r.dureeMs).toBeGreaterThan(0)
  })

  it('rend timeout=true et tue le worker quand le delai est depasse', async () => {
    vi.useFakeTimers()
    let cree: WorkerFactice | null = null
    const ex = new Executeur(() => {
      cree = new WorkerFactice(CHARGE, null)
      return cree as unknown as Worker
    }, 5000)
    const promesse = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(5001)
    const r = await promesse
    expect(r.timeout).toBe(true)
    expect(r.erreur?.type).toBe('TimeoutError')
    expect(cree!.termine).toBe(true)
    vi.useRealTimers()
  })

  it('recree un worker apres un timeout', async () => {
    vi.useFakeTimers()
    let nombreCreations = 0
    const ex = new Executeur(() => {
      nombreCreations++
      return new WorkerFactice(CHARGE, nombreCreations === 1 ? null : 1) as unknown as Worker
    }, 5000)
    const p1 = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(5001)
    await p1
    vi.useRealTimers()
    const r2 = await ex.executer({ code: 'print("Bonjour")', entrees: [], nomsVariables: [] })
    expect(r2.timeout).toBe(false)
    expect(nombreCreations).toBe(2)
  })
})

/** Faux Worker qui diffuse des morceaux de sortie avant sa reponse finale. */
class WorkerDiffusant {
  onmessage: ((e: { data: unknown }) => void) | null = null
  constructor(private morceaux: string[], private echoue = false) {}
  postMessage(demande: { id: string }) {
    setTimeout(() => {
      for (const flux of this.morceaux) this.onmessage?.({ data: { id: demande.id, flux } })
      // Un message d'un autre identifiant ne doit rien déclencher : deux
      // exécutions peuvent se chevaucher après un timeout.
      this.onmessage?.({ data: { id: 'un-autre', ok: true, charge: {} } })
      this.onmessage?.({ data: null })
      this.onmessage?.({
        data: this.echoue
          ? { id: demande.id, ok: false, message: 'worker mort' }
          : { id: demande.id, ok: true, charge: { stdout: this.morceaux.join(''), erreur: null, variables: {} } },
      })
    }, 1)
  }
  terminate() {}
}

describe('Executeur — la sortie qui arrive au fil de l eau', () => {
  it('appelle onSortie a chaque morceau, sans attendre la fin', async () => {
    const recus: string[] = []
    const ex = new Executeur(() => new WorkerDiffusant(['Bon', 'jour\n']) as unknown as Worker)

    const r = await ex.executer({
      code: 'print("Bonjour")',
      entrees: [],
      nomsVariables: [],
      onSortie: (m) => recus.push(m),
    })

    expect(recus).toEqual(['Bon', 'jour\n'])
    expect(r.stdout).toBe('Bonjour\n')
  })

  it('rend une erreur interne quand le worker abandonne', async () => {
    const ex = new Executeur(() => new WorkerDiffusant([], true) as unknown as Worker)
    const r = await ex.executer({ code: 'x = 1', entrees: [], nomsVariables: [] })

    expect(r.erreur?.type).toBe('ErreurInterne')
    expect(r.erreur?.message).toContain('worker mort')
    expect(r.stdout).toBe('')
  })
})

describe('Executeur — la fin de vie', () => {
  it('termine le worker et en repart d un neuf', async () => {
    // L'aperçu du professeur détruit son exécuteur en sortant : sans cela,
    // chaque ouverture laisserait un worker Pyodide derrière elle.
    const crees: WorkerFactice[] = []
    const ex = new Executeur(() => {
      const w = new WorkerFactice(CHARGE, 1)
      crees.push(w)
      return w as unknown as Worker
    })

    await ex.executer({ code: 'x = 1', entrees: [], nomsVariables: [] })
    ex.detruire()
    expect(crees[0]!.termine).toBe(true)

    await ex.executer({ code: 'x = 2', entrees: [], nomsVariables: [] })
    expect(crees).toHaveLength(2)
  })

  it('ne plante pas quand on detruit un executeur qui n a jamais servi', () => {
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 1) as unknown as Worker)
    expect(() => ex.detruire()).not.toThrow()
  })
})

describe('Executeur — un seul worker', () => {
  it('reutilise le meme worker d une execution a l autre', async () => {
    // Pyodide met plusieurs secondes à démarrer : en fabriquer un par
    // exécution rendrait chaque validation insupportable.
    let fabriques = 0
    const ex = new Executeur(() => {
      fabriques += 1
      return new WorkerFactice(CHARGE, 1) as unknown as Worker
    })

    await ex.executer({ code: 'x = 1', entrees: [], nomsVariables: [] })
    await ex.executer({ code: 'x = 2', entrees: [], nomsVariables: [] })

    expect(fabriques).toBe(1)
  })
})

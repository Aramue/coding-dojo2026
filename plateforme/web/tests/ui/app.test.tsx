import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app'

vi.mock('../../src/execution/executeur', () => ({
  Executeur: class {
    executer = vi.fn()
    detruire = vi.fn()
  },
}))

const CHAPITRES = [{ id: 'bases', ordre: 1, titre: 'Les bases de Python', seance: 1 }]

const NOTIONS = [
  {
    id: 'afficher',
    ordre: 1,
    titre: 'Afficher un message',
    famille: 'conditions',
    chapitre: 'bases',
  },
  {
    id: 'variables',
    ordre: 2,
    titre: 'Les variables',
    famille: 'variables',
    chapitre: 'bases',
  },
]

/** Le parcours renvoie une reussite datee, pas un simple identifiant. */
const REUSSI_S1_01 = {
  exercice_id: 's1-01',
  verdict: 'vert',
  le: '2026-09-16T12:32:00+00:00',
}

const EXERCICES = [
  {
    id: 's1-01',
    concept: 'print',
    notion: 'afficher',
    famille: 'conditions',
    seance: 1,
    niveau: 'normal',
    type: 'ecrire',
    titre: 'Dire bonjour',
    obligatoire: true,
    enonce: 'Affiche Bonjour.',
    depart: '',
    indices: [],
    tests: [{ type: 'interdit', motif: 'xyzzy' }],
  },
]

function poserLeReseau() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url.includes('chapitres')) return CHAPITRES
        if (url.includes('notions')) return NOTIONS
        if (url.includes('lecons')) return []
        if (url.includes('parcours')) return { reussis: [] }
        if (url.includes('session')) return { jeton: 'DOJO-TEST.sig', code_acces: 'DOJO-TEST' }
        return EXERCICES
      },
    })),
  )
}

beforeEach(() => {
  history.pushState(null, '', '/')
  sessionStorage.clear()
  poserLeReseau()
})

describe('App', () => {
  it("demande le code d'acces avant tout, et ne montre pas le menu", () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /sommaire/i })).toBeNull()
  })

  it('garde la porte fermee meme sur une URL profonde', () => {
    // La route est memorisee, pas perdue : la connexion faite, l'eleve y arrive.
    history.pushState(null, '', '/variables/exercices')
    render(<App />)
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  })

  it("se reconnecte seul quand un code est memorise, et affiche le menu", async () => {
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    render(<App />)
    expect(await screen.findByRole('navigation', { name: /sommaire/i })).toBeInTheDocument()
    expect(screen.getByText('Les variables')).toBeInTheDocument()
  })

  it("oublie un code memorise que le serveur refuse", async () => {
    sessionStorage.setItem('dojo.code-acces', 'DOJO-VIEU')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 422, json: async () => ({}) })))

    render(<App />)

    await waitFor(() => expect(sessionStorage.getItem('dojo.code-acces')).toBeNull())
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  })

  it('affiche « cette page n existe pas » sur une notion absente du contenu', async () => {
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/algebre/cours')
    render(<App />)
    expect(await screen.findByText(/n'existe pas/i)).toBeInTheDocument()
  })

  it('affiche « cette page n existe pas » sur un numero d exercice hors liste', async () => {
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/99')
    render(<App />)
    expect(await screen.findByText(/n'existe pas/i)).toBeInTheDocument()
  })

  it("ouvre l'exercice designe par son rang dans la notion", async () => {
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/1')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Dire bonjour' })).toBeInTheDocument()
  })
})

describe('App — le menu suit la progression', () => {
  it("reflete dans le menu les exercices deja reussis", async () => {
    // Le compteur etait fige sur sa valeur du moment de la connexion : les
    // groupes sont desormais derives de `reussis`, pas stockes.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) return CHAPITRES
          if (url.includes('notions')) return NOTIONS
          if (url.includes('lecons')) return []
          if (url.includes('parcours')) return { reussis: [REUSSI_S1_01] }
          if (url.includes('session')) return { jeton: 'DOJO-TEST.sig', code_acces: 'DOJO-TEST' }
          return EXERCICES
        },
      })),
    )
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    render(<App />)

    // L'avancement s'affiche a trois endroits : en-tete, chapitre, notion.
    // On vise la ligne de la notion.
    const notion = await screen.findByRole('button', { name: /Afficher un message/ })
    expect(within(notion).getByText('1/1')).toBeInTheDocument()
  })

  it("montre l'avancement global dans l'en-tete", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) return CHAPITRES
          if (url.includes('notions')) return NOTIONS
          if (url.includes('lecons')) return []
          if (url.includes('parcours')) return { reussis: [REUSSI_S1_01] }
          if (url.includes('session')) return { jeton: 'DOJO-TEST.sig', code_acces: 'DOJO-TEST' }
          return EXERCICES
        },
      })),
    )
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    render(<App />)

    const jauge = await screen.findByRole('progressbar', { name: /cours/i })
    expect(jauge).toHaveAttribute('aria-valuenow', '1')
    expect(jauge).toHaveAttribute('aria-valuemax', '1')
  })
})

describe('App — tableau de bord professeur', () => {
  it("s'atteint sur /prof sans code eleve", async () => {
    // Le tableau de bord a sa propre porte : il doit rester joignable meme
    // quand personne n'est connecte cote eleve.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ existe: true }) })),
    )
    history.pushState(null, '', '/prof')
    render(<App />)
    expect(await screen.findByLabelText(/^mot de passe$/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tableau de bord/i })).toBeInTheDocument()
  })

  it("propose de créer le compte au premier lancement", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ existe: false }) })),
    )
    history.pushState(null, '', '/prof')
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'Créer le compte professeur' }),
    ).toBeInTheDocument()
  })

  it('ne demande pas le mot de passe deux fois dans le meme onglet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ eleves: [] }) })),
    )
    sessionStorage.setItem('dojo.jeton-prof', 'prof.4102444800.signature')
    history.pushState(null, '', '/prof')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
  })

  it("dit ce qui ne va pas plutot que de rendre un ecran blanc", async () => {
    // Une reponse sans `eleves` plantait le rendu sur `.length`.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ pasCeQuOnAttend: true }) })),
    )
    sessionStorage.setItem('dojo.jeton-prof', 'prof.4102444800.signature')
    history.pushState(null, '', '/prof')
    render(<App />)
    const alertes = await screen.findAllByRole('alert')
    expect(alertes.some((a) => /inattendue/i.test(a.textContent ?? ''))).toBe(true)
  })

  it('ramène à la porte quand le jeton professeur est refusé', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/prof/compte'
          ? { ok: true, status: 200, json: async () => ({ existe: true }) }
          : { ok: false, status: 401, json: async () => ({}) },
      ),
    )
    sessionStorage.setItem('dojo.jeton-prof', 'prof.1.expire')
    history.pushState(null, '', '/prof')
    render(<App />)
    expect(await screen.findByLabelText(/^mot de passe$/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('dojo.jeton-prof')).toBeNull()
  })
})

describe("App — l'élève voit qui il est", () => {
  function reseau(session: Record<string, unknown>) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) return CHAPITRES
          if (url.includes('notions')) return NOTIONS
          if (url.includes('lecons')) return []
          if (url.includes('parcours')) return { reussis: [] }
          if (url.includes('session')) return session
          return EXERCICES
        },
      })),
    )
  }

  it('affiche le prénom en haut, à côté du code', async () => {
    reseau({ jeton: 'DOJO-TEST.sig', code_acces: 'DOJO-TEST', prenom: 'Camille' })
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    render(<App />)
    expect(await screen.findByText('Camille')).toBeInTheDocument()
    expect(screen.getByText('DOJO-TEST')).toBeInTheDocument()
  })

  it("n'affiche que le code tant que le professeur n'a saisi aucun prénom", async () => {
    reseau({ jeton: 'DOJO-TEST.sig', code_acces: 'DOJO-TEST', prenom: '' })
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    const { container } = render(<App />)
    expect(await screen.findByText('DOJO-TEST')).toBeInTheDocument()
    expect(container.querySelector('.entete__prenom')).toBeNull()
  })
})

describe('App — une séance s’ouvre à sa date', () => {
  const DECISIONS = { id: 'decisions', ordre: 2, titre: 'Calculer, comparer, décider', seance: 2 }
  const CALCULER = {
    id: 'calculer',
    ordre: 3,
    titre: 'Calculer',
    famille: 'operateurs',
    chapitre: 'decisions',
  }

  function reseau(ouverture: string) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) return [...CHAPITRES, { ...DECISIONS, ouverture }]
          if (url.includes('notions')) return [...NOTIONS, CALCULER]
          if (url.includes('lecons')) return []
          if (url.includes('parcours')) return { reussis: [] }
          if (url.includes('session')) return { jeton: 'DOJO-TEST.sig', code_acces: 'DOJO-TEST' }
          return EXERCICES
        },
      })),
    )
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
  }

  it('cache une séance avant sa date, et nomme celle du jour', async () => {
    reseau('2999-01-01')
    render(<App />)
    await screen.findByRole('navigation', { name: /sommaire/i })
    expect(screen.queryByText('Calculer')).toBeNull()
    expect(screen.getByText('Séance 1 — Les bases de Python')).toBeInTheDocument()
  })

  it('la montre à partir de sa date, et la nomme dans l’en-tête', async () => {
    reseau('2000-01-01')
    render(<App />)
    expect(await screen.findByText('Calculer')).toBeInTheDocument()
    expect(screen.getByText('Séance 2 — Calculer, comparer, décider')).toBeInTheDocument()
  })
})

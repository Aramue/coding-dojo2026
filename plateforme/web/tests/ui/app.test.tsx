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

  it("montre l'avancement global de la seance dans l'en-tete", async () => {
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

    const jauge = await screen.findByRole('progressbar', { name: /séance/i })
    expect(jauge).toHaveAttribute('aria-valuenow', '1')
    expect(jauge).toHaveAttribute('aria-valuemax', '1')
  })
})

describe('App — tableau de bord professeur', () => {
  it("s'atteint sur /prof sans code eleve", async () => {
    // Le tableau de bord a sa propre porte : il doit rester joignable meme
    // quand personne n'est connecte cote eleve.
    history.pushState(null, '', '/prof')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /tableau de bord/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/code professeur/i)).toBeInTheDocument()
  })

  it('ne demande pas le code deux fois dans le meme onglet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ eleves: [] }) })),
    )
    sessionStorage.setItem('dojo.code-prof', 'code-prof-test')
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
    sessionStorage.setItem('dojo.code-prof', 'code-prof-test')
    history.pushState(null, '', '/prof')
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/inattendue/i)
  })

  it('affiche un refus quand le code professeur est faux', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
    sessionStorage.setItem('dojo.code-prof', 'faux')
    history.pushState(null, '', '/prof')
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/refus/i)
  })
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe("App — quand le navigateur refuse de retenir la session", () => {
  it('retombe sur la saisie du code au lieu de planter', () => {
    // Navigation privée, cookies bloqués : sans ce filet, l'élève tombe sur
    // un écran blanc et n'a aucun moyen de comprendre pourquoi.
    const lire = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('refus')
    })
    render(<App />)
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
    lire.mockRestore()
  })
})

describe("App — la page « exercices » d'une notion", () => {
  it("liste les exercices de la notion demandée", async () => {
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices')
    render(<App />)
    expect(await screen.findByRole('link', { name: /Dire bonjour/ })).toBeInTheDocument()
  })
})

describe('App — enregistrer une tentative', () => {
  /** Le réseau de l'élève, avec le sort réservé à POST /tentative. */
  function reseau(options: { tentativeEchoue?: boolean } = {}) {
    const envois: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('tentative')) {
          envois.push(JSON.parse(String(init?.body)))
          if (options.tentativeEchoue) return { ok: false, status: 503, json: async () => ({}) }
          return { ok: true, json: async () => ({ expert_debloque: null }) }
        }
        return {
          ok: true,
          json: async () => {
            if (url.includes('chapitres')) return CHAPITRES
            if (url.includes('notions')) return NOTIONS
            if (url.includes('lecons')) return []
            if (url.includes('parcours')) return { reussis: [] }
            if (url.includes('session')) return { jeton: 'j', code_acces: 'DOJO-TEST' }
            return [{ ...EXERCICES[0], depart: 'print("Bonjour")' }]
          },
        }
      }),
    )
    return envois
  }

  it("enregistre la réussite et fait avancer la jauge", async () => {
    const envois = reseau()
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/1')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ exercice_id: 's1-01', verdict: 'vert' })
    // La jauge de l'en-tête compte désormais cette réussite.
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeInTheDocument())
  })

  it("n'envoie jamais le code de l'élève avec sa tentative", async () => {
    const envois = reseau()
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/1')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(JSON.stringify(envois[0])).not.toContain('print')
  })

  it("prévient et ne fait PAS avancer quand l'enregistrement échoue", async () => {
    // Sans cela l'élève croit la réussite acquise, et la perd au rechargement.
    reseau({ tentativeEchoue: true })
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/1')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    const alertes = await screen.findAllByRole('alert')
    expect(alertes.some((a) => /n'a pas pu être enregistrée/.test(a.textContent ?? ''))).toBe(true)
    expect(screen.getByText('0 / 1')).toBeInTheDocument()
  })
})

describe('App — rejouer un exercice déjà réussi', () => {
  it('garde la meilleure coche : rejouer moins bien n en retire pas une', async () => {
    // ADR-011 : la seconde coche récompense la méthode. La perdre parce qu'on
    // a refait l'exercice autrement serait une punition pour avoir réessayé.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) return CHAPITRES
          if (url.includes('notions')) return NOTIONS
          if (url.includes('lecons')) return []
          if (url.includes('parcours')) {
            return { reussis: [{ exercice_id: 's1-01', verdict: 'vert', le: '2026-09-16T12:00:00Z' }] }
          }
          if (url.includes('session')) return { jeton: 'j', code_acces: 'DOJO-TEST' }
          if (url.includes('tentative')) return { expert_debloque: null }
          return [{ ...EXERCICES[0], depart: 'print("Bonjour")' }]
        },
      })),
    )
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/1')
    render(<App />)

    await screen.findByText('1 / 1')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    // La jauge ne double pas l'entrée, et la réussite reste acquise.
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeInTheDocument())
  })
})

describe('App — les voisins d un exercice', () => {
  function reseauDeuxExercices() {
    const second = { ...EXERCICES[0]!, id: 's1-02', titre: 'Dire au revoir' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) return CHAPITRES
          if (url.includes('notions')) return NOTIONS
          if (url.includes('lecons')) return []
          if (url.includes('parcours')) return { reussis: [] }
          if (url.includes('session')) return { jeton: 'j', code_acces: 'DOJO-TEST' }
          return [EXERCICES[0], second]
        },
      })),
    )
  }

  it('renvoie à la liste depuis le premier, et au suivant nommé', async () => {
    reseauDeuxExercices()
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/1')
    render(<App />)

    expect(await screen.findByRole('link', { name: /Dire au revoir/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Liste des exercices/ }).length).toBeGreaterThan(0)
  })

  it('nomme le précédent depuis le dernier', async () => {
    reseauDeuxExercices()
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/2')
    render(<App />)

    expect(await screen.findByRole('link', { name: /Dire bonjour/ })).toBeInTheDocument()
  })
})

describe('App — une classe qui a tout fini', () => {
  it("ne redirige nulle part quand il n'y a aucune notion ouverte", async () => {
    // Sans la garde, `premiereOuverte` rendant `undefined` ferait naviguer
    // vers une notion inexistante et l'élève tomberait sur « page inconnue ».
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('session')) return { jeton: 'j', code_acces: 'DOJO-TEST' }
          if (url.includes('parcours')) return { reussis: [] }
          return []
        },
      })),
    )
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/')
    render(<App />)

    await new Promise((r) => setTimeout(r, 20))
    expect(location.pathname).toBe('/')
  })
})

describe('App — une tentative ratée', () => {
  it("enregistre l'échec sans faire avancer la jauge", async () => {
    // Le professeur doit voir l'échec dans son tableau ; l'élève ne doit pas
    // voir sa jauge bouger pour autant.
    const envois: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('tentative')) {
          envois.push(JSON.parse(String(init?.body)))
          return { ok: true, json: async () => ({ expert_debloque: null }) }
        }
        return {
          ok: true,
          json: async () => {
            if (url.includes('chapitres')) return CHAPITRES
            if (url.includes('notions')) return NOTIONS
            if (url.includes('lecons')) return []
            if (url.includes('parcours')) return { reussis: [] }
            if (url.includes('session')) return { jeton: 'j', code_acces: 'DOJO-TEST' }
            // Un motif interdit que le code de départ viole : le verdict est
            // rouge sans solliciter Pyodide, que ce fichier simule.
            return [
              {
                ...EXERCICES[0],
                depart: 'print("Bonjour")',
                tests: [{ type: 'interdit', motif: 'print' }],
              },
            ]
          },
        }
      }),
    )
    sessionStorage.setItem('dojo.code-acces', 'DOJO-TEST')
    history.pushState(null, '', '/afficher/exercices/1')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ verdict: 'rouge' })
    expect(screen.getByText('0 / 1')).toBeInTheDocument()
  })
})

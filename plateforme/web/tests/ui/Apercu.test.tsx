import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Apercu } from '../../src/ui/Apercu'
import type { Executeur } from '../../src/execution/executeur'

const CHAPITRES = [{ id: 'bases', ordre: 1, titre: 'Les bases de Python', seance: 1 }]

const NOTIONS = [
  { id: 'afficher', ordre: 1, titre: 'Afficher un message', famille: 'conditions', chapitre: 'bases' },
  { id: 'saisie', ordre: 4, titre: 'Demander une information', famille: 'operateurs', chapitre: 'bases' },
]

function ex(id: string, notion: string, titre: string) {
  return {
    id,
    concept: 'print',
    notion,
    famille: 'conditions',
    seance: 1,
    niveau: 'normal',
    type: 'ecrire',
    titre,
    obligatoire: true,
    enonce: `Énoncé de ${titre}.`,
    depart: '',
    indices: [],
    tests: [{ type: 'interdit', motif: 'xyzzy' }],
  }
}

const EXERCICES = [
  ex('s1-01', 'afficher', 'Dire bonjour'),
  ex('s1-31', 'saisie', 'Deux questions, une fiche'),
]

const LECONS = [
  {
    id: 'c1-afficher',
    notion: 'afficher',
    ordre: 1,
    titre: 'Afficher un message',
    dureeMin: 3,
    famille: 'conditions',
    blocs: [{ type: 'paragraphe', texte: 'Un programme qui ne dit rien ne sert à rien.' }],
  },
]

const EXECUTEUR = { executer: vi.fn(), detruire: vi.fn() } as unknown as Executeur

beforeEach(() => {
  vi.unstubAllGlobals()
  history.pushState(null, '', '/prof')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url.includes('chapitres')) return CHAPITRES
        if (url.includes('notions')) return NOTIONS
        if (url.includes('lecons')) return LECONS
        return EXERCICES
      },
    })),
  )
})

describe("Apercu — ce que l'élève voit", () => {
  it('ouvre sur la première leçon quand rien n est demandé', async () => {
    render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Afficher un message' })).toBeInTheDocument()
  })

  it("ouvre sur l'exercice demandé", async () => {
    render(
      <Apercu
        depart={{ vue: 'exercice', notion: 'saisie', numero: 1 }}
        executeur={EXECUTEUR}
        onFermer={vi.fn()}
      />,
    )
    expect(
      await screen.findByRole('heading', { name: 'Deux questions, une fiche' }),
    ).toBeInTheDocument()
  })

  it("montre l'énoncé réel, pas un résumé", async () => {
    render(
      <Apercu
        depart={{ vue: 'exercice', notion: 'saisie', numero: 1 }}
        executeur={EXECUTEUR}
        onFermer={vi.fn()}
      />,
    )
    expect(await screen.findByText(/Énoncé de Deux questions/)).toBeInTheDocument()
  })

  it('affiche une progression vide : ce n est la copie de personne', async () => {
    render(
      <Apercu
        depart={{ vue: 'exercices', notion: 'saisie' }}
        executeur={EXECUTEUR}
        onFermer={vi.fn()}
      />,
    )
    expect(await screen.findByText('0 / 1')).toBeInTheDocument()
  })

  it('dit que rien n est enregistré', async () => {
    render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    expect(await screen.findByText(/Rien n'est enregistré ici/)).toBeInTheDocument()
  })

  it('se ferme', async () => {
    const fermer = vi.fn()
    render(<Apercu executeur={EXECUTEUR} onFermer={fermer} />)
    await userEvent.click(await screen.findByRole('button', { name: /Fermer l'aperçu/ }))
    expect(fermer).toHaveBeenCalled()
  })
})

describe('Apercu — la navigation reste dans le cadre', () => {
  it("ne fait pas quitter le tableau de bord au professeur", async () => {
    // Les composants eleve naviguent par pushState. Sans interception, un clic
    // dans l'apercu emmenerait le professeur sur l'espace eleve.
    render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    const menu = await screen.findByRole('navigation', { name: /sommaire/i })
    await userEvent.click(within(menu).getAllByRole('link', { name: 'Exercices' })[0]!)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Exercices' })).toBeInTheDocument())
    expect(location.pathname).toBe('/prof')
  })

  it('suit le lien cliqué', async () => {
    render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    const menu = await screen.findByRole('navigation', { name: /sommaire/i })
    await userEvent.click(within(menu).getAllByRole('link', { name: 'Exercices' })[0]!)
    expect(await screen.findByRole('link', { name: /Dire bonjour/ })).toBeInTheDocument()
  })
})

describe('Apercu — une fenêtre par-dessus, pas un cadre en bas de page', () => {
  it("s'annonce comme une fenêtre modale", async () => {
    // Encadre sous le tableau, il s'ouvrait a mille pixels du clic : on
    // cliquait sur un exercice et rien ne semblait se passer.
    render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    const fenetre = await screen.findByRole('dialog', { name: /Aperçu de l'espace élève/ })
    expect(fenetre).toHaveAttribute('aria-modal', 'true')
  })

  it('se ferme sur Échap', async () => {
    const fermer = vi.fn()
    render(<Apercu executeur={EXECUTEUR} onFermer={fermer} />)
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(fermer).toHaveBeenCalled()
  })

  it('fige le fond, puis le rend', async () => {
    // Deux defilements superposes, on ne sait plus lequel on pilote.
    const { unmount } = render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    await screen.findByRole('dialog')
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('prend le focus, pour que la tabulation ne coure pas derrière', async () => {
    render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    expect(await screen.findByRole('dialog')).toHaveFocus()
  })
})

describe('Apercu — les séances à venir', () => {
  function reseauAvecSeance2(ouverture: string) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) {
            return [
              ...CHAPITRES,
              { id: 'decisions', ordre: 2, titre: 'Calculer, comparer, décider', seance: 2, ouverture },
            ]
          }
          if (url.includes('notions')) {
            return [
              ...NOTIONS,
              { id: 'calculer', ordre: 6, titre: 'Calculer', famille: 'operateurs', chapitre: 'decisions' },
            ]
          }
          if (url.includes('lecons')) return LECONS
          return EXERCICES
        },
      })),
    )
  }

  it('montre une séance pas encore ouverte, et dit que la classe ne la voit pas', async () => {
    // C'est avant une séance qu'on la cadre : l'aperçu doit pouvoir la montrer.
    reseauAvecSeance2('2999-01-01')
    render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    expect(
      await screen.findByText(
        /ne voient pas encore « Calculer, comparer, décider » : la séance 2 s'ouvre le/,
      ),
    ).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: /sommaire/i })
    expect(within(menu).getByText('Calculer')).toBeInTheDocument()
  })

  it('ne signale rien quand la séance est ouverte', async () => {
    reseauAvecSeance2('2000-01-01')
    render(<Apercu executeur={EXECUTEUR} onFermer={vi.fn()} />)
    await screen.findByRole('navigation', { name: /sommaire/i })
    expect(screen.queryByText(/ne voient pas encore/)).toBeNull()
  })
})

describe("Apercu — les destinations qui ne menent nulle part", () => {
  it("dit que la page n'existe pas plutot que de rendre un cadre vide", async () => {
    // Le tableau de bord peut demander une destination que l'aperçu ne sait
    // pas montrer — la connexion, sa propre page. Un cadre vide laisserait le
    // professeur croire à un chargement qui n'arrive jamais.
    render(<Apercu depart={{ vue: 'prof', onglet: 'seance' }} executeur={EXECUTEUR} onFermer={() => {}} />)
    expect(await screen.findByText("Cette page n'existe pas.")).toBeInTheDocument()
  })

  it("dit qu'un exercice demande hors liste n'existe pas", async () => {
    render(
      <Apercu
        depart={{ vue: 'exercice', notion: 'afficher', numero: 99 }}
        executeur={EXECUTEUR}
        onFermer={() => {}}
      />,
    )
    expect(await screen.findByText("Cet exercice n'existe pas.")).toBeInTheDocument()
  })

  it("dit qu'une notion inconnue n'existe pas", async () => {
    render(
      <Apercu
        depart={{ vue: 'cours', notion: 'algebre' }}
        executeur={EXECUTEUR}
        onFermer={() => {}}
      />,
    )
    expect(await screen.findByText("Cette page n'existe pas.")).toBeInTheDocument()
  })
})

describe("Apercu — rien ne s'enregistre", () => {
  it("avale la tentative du professeur au lieu de l'envoyer a la seance", async () => {
    // Le professeur résout l'exercice pour le vérifier. Si cette tentative
    // partait, elle atterrirait dans la séance de la classe.
    const envois: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') envois.push(url)
        return {
          ok: true,
          json: async () => {
            if (url.includes('chapitres')) return CHAPITRES
            if (url.includes('notions')) return NOTIONS
            if (url.includes('lecons')) return LECONS
            // Un depart non vide, et un test 'sortie' : un test 'interdit'
            // seul n'appelle jamais Pyodide, et rien ne s'executerait.
            return [
              {
                ...EXERCICES[0],
                depart: 'print("Bonjour")',
                tests: [
                  { type: 'sortie', entrees: [], attendu: 'Bonjour' },
                  { type: 'interdit', motif: 'xyzzy' },
                ],
              },
            ]
          },
        }
      }),
    )
    const executeur = {
      executer: vi.fn(async () => ({
        stdout: 'Bonjour\n',
        erreur: null,
        variables: {},
        dureeMs: 3,
        timeout: false,
      })),
      detruire: vi.fn(),
    } as unknown as Executeur

    render(
      <Apercu
        depart={{ vue: 'exercice', notion: 'afficher', numero: 1 }}
        executeur={executeur}
        onFermer={() => {}}
      />,
    )
    await userEvent.click(await screen.findByRole('button', { name: /valider/i }))

    await waitFor(() => expect(executeur.executer).toHaveBeenCalled())
    expect(envois).toEqual([])
  })
})

describe('Apercu — les voisins et le clavier', () => {
  it("nomme l'exercice précédent et le suivant quand ils existent", async () => {
    // Deux exercices dans la même notion : le pied porte leurs titres au lieu
    // de renvoyer deux fois à la liste.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) return CHAPITRES
          if (url.includes('notions')) return NOTIONS
          if (url.includes('lecons')) return LECONS
          return [
            ex('s1-01', 'afficher', 'Dire bonjour'),
            ex('s1-02', 'afficher', 'Dire au revoir'),
            ex('s1-03', 'afficher', 'Dire merci'),
          ]
        },
      })),
    )
    render(
      <Apercu
        depart={{ vue: 'exercice', notion: 'afficher', numero: 2 }}
        executeur={EXECUTEUR}
        onFermer={() => {}}
      />,
    )

    expect(await screen.findByRole('link', { name: /Dire bonjour/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Dire merci/ })).toBeInTheDocument()
  })

  it("ignore une touche qui n'est pas Échap", async () => {
    const onFermer = vi.fn()
    render(<Apercu executeur={EXECUTEUR} onFermer={onFermer} />)
    await screen.findByRole('dialog')

    await userEvent.keyboard('a')
    expect(onFermer).not.toHaveBeenCalled()
  })
})

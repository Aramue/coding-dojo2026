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

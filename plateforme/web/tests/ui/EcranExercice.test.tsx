import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EcranExercice } from '../../src/ui/EcranExercice'
import type { Executeur, DemandeExecution } from '../../src/execution/executeur'
import type { ResultatExecution } from '../../src/execution/types'
import type { Exercice } from '../../src/contenu/types'
import type { Reussite, Test } from '../../src/validation/types'

function exercice(surcharge: Partial<Exercice> = {}): Exercice {
  return {
    id: 's1-09',
    concept: 'variable',
    notion: 'variables',
    famille: 'variables',
    seance: 1,
    niveau: 'normal',
    type: 'ecrire',
    titre: 'Ranger un prénom',
    obligatoire: true,
    enonce: 'Affiche Bonjour.',
    depart: '',
    indices: [],
    tests: [{ type: 'sortie', attendu: 'Bonjour', entrees: [] }] as Test[],
    ...surcharge,
  }
}

/**
 * Un exécuteur de test qui rejoue un scénario de sortie.
 *
 * Chaque appel diffuse ses morceaux par `onSortie` avant de résoudre, comme le
 * worker : c'est ce qui permet d'observer la console pendant l'exécution.
 */
function executeurFactice(reponses: { morceaux: string[]; stdout?: string }[]): Executeur {
  let appel = 0
  return {
    executer: async (demande: DemandeExecution): Promise<ResultatExecution> => {
      const scenario = reponses[appel++] ?? { morceaux: [] }
      for (const morceau of scenario.morceaux) demande.onSortie?.(morceau)
      return {
        stdout: scenario.stdout ?? scenario.morceaux.join(''),
        erreur: null,
        variables: {},
        dureeMs: 3,
        timeout: false,
      }
    },
    detruire: vi.fn(),
  } as unknown as Executeur
}

const REUSSITE: Reussite = {
  exerciceId: 's1-09',
  verdict: 'vert',
  le: '2026-09-16T12:32:00.000Z',
}

describe('EcranExercice — rappel de réussite', () => {
  it("date la réussite quand l'élève revient sur un exercice validé", () => {
    render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([])}
        dejaFait={REUSSITE}
        onTentative={vi.fn()}
      />,
    )
    expect(screen.getByText(/Validé le .*2026/)).toBeInTheDocument()
  })

  it('porte la mention de la méthode maîtrisée, et deux coches', () => {
    const { container } = render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([])}
        dejaFait={REUSSITE}
        onTentative={vi.fn()}
      />,
    )
    expect(screen.getByText('Réussi, méthode maîtrisée')).toBeInTheDocument()
    expect(container.querySelector('.rappel')).toHaveAttribute('data-niveau', '2')
    expect(container.querySelectorAll('.rappel__coches svg')).toHaveLength(2)
  })

  it('dit ce qui manque quand une seule coche a été obtenue', () => {
    const { container } = render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([])}
        dejaFait={{ ...REUSSITE, verdict: 'bleu' }}
        onTentative={vi.fn()}
      />,
    )
    expect(screen.getByText('Réussi')).toBeInTheDocument()
    expect(screen.getByText(/Il te reste une coche/)).toBeInTheDocument()
    expect(container.querySelectorAll('.rappel__coches svg')).toHaveLength(1)
  })

  it("ne rappelle rien sur un exercice jamais réussi", () => {
    const { container } = render(
      <EcranExercice exercice={exercice()} executeur={executeurFactice([])} onTentative={vi.fn()} />,
    )
    expect(container.querySelector('.rappel')).toBeNull()
  })

  it("s'efface dès la première validation de la visite, au profit du verdict", async () => {
    const { container } = render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([{ morceaux: ['Bonjour'] }])}
        dejaFait={REUSSITE}
        onTentative={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(container.querySelector('.rappel')).toBeNull())
  })

  it('affiche un rappel même sans date lisible', () => {
    render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([])}
        dejaFait={{ ...REUSSITE, le: 'pas-une-date' }}
        onTentative={vi.fn()}
      />,
    )
    expect(screen.getByText(/Déjà validé/)).toBeInTheDocument()
  })
})

describe('EcranExercice — console', () => {
  it('attend une exécution avant de montrer quoi que ce soit', () => {
    render(
      <EcranExercice exercice={exercice()} executeur={executeurFactice([])} onTentative={vi.fn()} />,
    )
    expect(screen.getByText(/Valide pour l'exécuter/)).toBeInTheDocument()
  })

  it('montre ce que le programme a écrit', async () => {
    const { container } = render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([{ morceaux: ['Bon', 'jour\n'] }])}
        onTentative={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() =>
      expect(container.querySelector('.console__texte')).toHaveTextContent('Bonjour'),
    )
  })

  it('recolle les morceaux diffusés dans l ordre où ils arrivent', async () => {
    const { container } = render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([{ morceaux: ['un\n', 'deux\n', 'trois'] }])}
        onTentative={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() =>
      expect(container.querySelector('.console__texte')).toHaveTextContent('un deux trois'),
    )
  })

  it("sépare les passages quand l'exercice éprouve plusieurs jeux d'entrées", async () => {
    const deuxTests = exercice({
      tests: [
        { type: 'sortie', attendu: 'Bonjour Marie', entrees: ['Marie'] },
        { type: 'sortie', attendu: 'Bonjour Yann', entrees: ['Yann'] },
      ] as Test[],
    })
    const { container } = render(
      <EcranExercice
        exercice={deuxTests}
        executeur={executeurFactice([
          { morceaux: ['Bonjour Marie'] },
          { morceaux: ['Bonjour Yann'] },
        ])}
        onTentative={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() =>
      expect(container.querySelectorAll('.console__passage')).toHaveLength(2),
    )
    expect(screen.getByText('Essai avec Marie')).toBeInTheDocument()
    expect(screen.getByText('Essai avec Yann')).toBeInTheDocument()
  })

  it("n'ouvre qu'un passage quand deux tests partagent les mêmes entrées", async () => {
    // Le cache evite la seconde execution : un second passage afficherait deux
    // fois la meme sortie, pour une seule execution reelle.
    const memeEntrees = exercice({
      tests: [
        { type: 'sortie', attendu: 'Bonjour', entrees: [] },
        { type: 'sortie', attendu: 'Bonjour', entrees: [] },
      ] as Test[],
    })
    const { container } = render(
      <EcranExercice
        exercice={memeEntrees}
        executeur={executeurFactice([{ morceaux: ['Bonjour'] }])}
        onTentative={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() =>
      expect(container.querySelectorAll('.console__passage')).toHaveLength(1),
    )
  })

  it('le dit quand le programme n a rien affiché', async () => {
    render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([{ morceaux: [] }])}
        onTentative={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(screen.getByText(/rien affiché/)).toBeInTheDocument())
  })

  it('repart de zéro à chaque validation', async () => {
    const { container } = render(
      <EcranExercice
        exercice={exercice()}
        executeur={executeurFactice([{ morceaux: ['premier'] }, { morceaux: ['second'] }])}
        onTentative={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(screen.getByText('premier')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(screen.getByText('second')).toBeInTheDocument())
    expect(container.querySelectorAll('.console__passage')).toHaveLength(1)
  })

  it("ne montre pas de console sur un QCM : rien ne s'y exécute", () => {
    const qcm = exercice({
      type: 'predire',
      tests: [{ type: 'qcm', options: ['4', '22'], bonneReponse: 0 }] as Test[],
    })
    const { container } = render(
      <EcranExercice exercice={qcm} executeur={executeurFactice([])} onTentative={vi.fn()} />,
    )
    expect(container.querySelector('.console')).toBeNull()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageExercices } from '../../src/ui/PageExercices'
import type { GroupeNotion } from '../../src/contenu/notions'
import type { Exercice } from '../../src/contenu/types'

function ex(id: string, titre: string, type: Exercice['type']): Exercice {
  return {
    id,
    concept: 'variable',
    notion: 'variables',
    famille: 'variables',
    seance: 1,
    niveau: 'normal',
    type,
    titre,
    obligatoire: true,
    enonce: '',
    depart: '',
    indices: [],
    tests: [],
  }
}

const GROUPE: GroupeNotion = {
  id: 'variables',
  ordre: 2,
  titre: 'Les variables',
  famille: 'variables',
  lecon: null,
  faits: 1,
  exercices: [
    ex('s1-09', 'Ranger un prénom', 'ecrire'),
    ex('s1-10', 'Que vaut score ?', 'predire'),
  ],
}

describe('PageExercices', () => {
  it('liste tous les exercices de la notion', () => {
    render(<PageExercices groupe={GROUPE} reussis={['s1-09']} />)
    expect(screen.getByText('Ranger un prénom')).toBeInTheDocument()
    expect(screen.getByText('Que vaut score ?')).toBeInTheDocument()
  })

  it('marque les exercices reussis', () => {
    const { container } = render(<PageExercices groupe={GROUPE} reussis={['s1-09']} />)
    expect(container.querySelectorAll('[data-etat="reussi"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-etat="a-faire"]')).toHaveLength(1)
  })

  it("annonce l'etat aux lecteurs d'ecran, pas seulement par la couleur", () => {
    render(<PageExercices groupe={GROUPE} reussis={['s1-09']} />)
    expect(screen.getByText('réussi')).toBeInTheDocument()
    expect(screen.getByText('à faire')).toBeInTheDocument()
  })

  it('numerote les exercices restant a faire', () => {
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('nomme le type de chaque exercice en francais', () => {
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    expect(screen.getByText('À écrire')).toBeInTheDocument()
    expect(screen.getByText('À lire')).toBeInTheDocument()
  })

  it("rappelle l'avancement de la notion", () => {
    render(<PageExercices groupe={GROUPE} reussis={['s1-09']} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('ouvre un exercice par son rang dans la notion', async () => {
    const pushState = vi.spyOn(history, 'pushState')
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    await userEvent.click(screen.getByRole('link', { name: /Que vaut score/ }))
    expect(pushState).toHaveBeenCalledWith(null, '', '/variables/exercices/2')
    pushState.mockRestore()
  })

  it("n'a aucun exercice verrouille", () => {
    // Aucun cul-de-sac : un exercice bloquant ne doit jamais arreter l'eleve.
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    const liens = screen.getAllByRole('link')
    expect(liens).toHaveLength(2)
    for (const lien of liens) {
      expect(lien).not.toHaveAttribute('aria-disabled', 'true')
      expect(lien).toHaveAttribute('href')
    }
  })

  it('laisse le navigateur ouvrir un nouvel onglet sur ctrl-clic', async () => {
    const utilisateur = userEvent.setup()
    const pushState = vi.spyOn(history, 'pushState')
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    await utilisateur.keyboard('{Control>}')
    await utilisateur.click(screen.getByRole('link', { name: /Ranger un prénom/ }))
    await utilisateur.keyboard('{/Control}')
    expect(pushState).not.toHaveBeenCalled()
    pushState.mockRestore()
  })

  it('annonce une notion sans exercice', () => {
    render(<PageExercices groupe={{ ...GROUPE, exercices: [], faits: 0 }} reussis={[]} />)
    expect(screen.getByText(/pas encore d'exercice/i)).toBeInTheDocument()
  })
})

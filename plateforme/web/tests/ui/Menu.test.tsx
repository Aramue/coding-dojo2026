import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Menu } from '../../src/ui/Menu'
import type { GroupeChapitre, GroupeNotion } from '../../src/contenu/notions'

/** Le menu ne lit que le nombre d'exercices : un objet partiel suffit. */
function exercices(nombre: number): GroupeNotion['exercices'] {
  return Array.from({ length: nombre }, (_, i) => ({
    id: `s1-0${i + 1}`,
  })) as unknown as GroupeNotion['exercices']
}

const NOTIONS: GroupeNotion[] = [
  {
    id: 'afficher',
    ordre: 1,
    titre: 'Afficher un message',
    famille: 'conditions',
    chapitre: 'bases',
    exercices: exercices(7),
    lecon: null,
    faits: 7,
  },
  {
    id: 'variables',
    ordre: 2,
    titre: 'Les variables',
    famille: 'variables',
    chapitre: 'bases',
    exercices: exercices(6),
    lecon: null,
    faits: 1,
  },
]

const CHAPITRES: GroupeChapitre[] = [
  {
    id: 'bases',
    ordre: 1,
    titre: 'Les bases de Python',
    seance: 1,
    notions: NOTIONS,
    faits: 8,
    total: 13,
  },
]

describe('Menu', () => {
  it('affiche le chapitre et son avancement cumulé', () => {
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />)
    expect(screen.getByRole('button', { name: /Les bases de Python/ })).toBeInTheDocument()
    expect(screen.getByText('8/13')).toBeInTheDocument()
  })

  it('liste chaque notion avec son avancement', () => {
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />)
    expect(screen.getByRole('button', { name: /Les variables/ })).toBeInTheDocument()
    expect(screen.getByText('1/6')).toBeInTheDocument()
    expect(screen.getByText('7/7')).toBeInTheDocument()
  })

  it('replie et déplie le chapitre', async () => {
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />)
    const tete = screen.getByRole('button', { name: /Les bases de Python/ })
    expect(tete).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(tete)
    expect(tete).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(tete)
    expect(tete).toHaveAttribute('aria-expanded', 'true')
  })

  it('ouvre la notion de la page courante, et elle seule', () => {
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'cours', notion: 'variables' }} />)
    expect(screen.getByRole('button', { name: /Les variables/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('button', { name: /Afficher un message/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('donne deux liens par notion', () => {
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />)
    expect(screen.getAllByRole('link', { name: 'Cours' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Exercices' })).toHaveLength(2)
  })

  it('marque la destination courante', () => {
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'cours', notion: 'variables' }} />)
    const courant = screen.getByRole('link', { current: 'page' })
    expect(courant).toHaveAccessibleName('Cours')
    expect(courant).toHaveAttribute('href', '/variables/cours')
  })

  it("marque la liste d'exercices quand un exercice de la notion est ouvert", () => {
    // Sinon l'eleve perd de vue ou il se trouve des qu'il ouvre un exercice.
    render(
      <Menu chapitres={CHAPITRES} destination={{ vue: 'exercice', notion: 'variables', numero: 2 }} />,
    )
    expect(screen.getByRole('link', { current: 'page' })).toHaveAccessibleName('Exercices')
  })

  it('navigue sans recharger la page', async () => {
    const pushState = vi.spyOn(history, 'pushState')
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />)
    await userEvent.click(screen.getAllByRole('link', { name: 'Exercices' })[1]!)
    expect(pushState).toHaveBeenCalledWith(null, '', '/variables/exercices')
    pushState.mockRestore()
  })

  it("laisse le navigateur ouvrir un nouvel onglet sur ctrl-clic", async () => {
    // setup() partage l'etat du clavier entre keyboard() et click() ; les
    // appels directs sur userEvent creent une instance neuve a chaque fois et
    // perdent la touche maintenue.
    const utilisateur = userEvent.setup()
    const pushState = vi.spyOn(history, 'pushState')
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />)
    await utilisateur.keyboard('{Control>}')
    await utilisateur.click(screen.getAllByRole('link', { name: 'Cours' })[0]!)
    await utilisateur.keyboard('{/Control}')
    expect(pushState).not.toHaveBeenCalled()
    pushState.mockRestore()
  })

  it('porte la famille de couleur de chaque notion', () => {
    const { container } = render(
      <Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />,
    )
    expect(container.querySelector('[data-famille="variables"]')).toBeInTheDocument()
    expect(container.querySelector('[data-famille="conditions"]')).toBeInTheDocument()
  })

  it('marque une notion terminée par une coche, pas par son rang', () => {
    const { container } = render(
      <Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />,
    )
    const terminee = screen.getByRole('button', { name: /Afficher un message/ })
    expect(within(terminee).queryByText('1')).toBeNull()
    expect(terminee.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelectorAll('.notion__rang svg')).toHaveLength(1)
  })

  it('se laisse nommer aux technologies d assistance', () => {
    render(<Menu chapitres={CHAPITRES} destination={{ vue: 'connexion' }} />)
    expect(screen.getByRole('navigation', { name: /sommaire/i })).toBeInTheDocument()
  })
})

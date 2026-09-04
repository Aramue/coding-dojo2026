import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Menu } from '../../src/ui/Menu'
import type { GroupeNotion } from '../../src/contenu/notions'

const GROUPES: GroupeNotion[] = [
  {
    id: 'afficher',
    ordre: 1,
    titre: 'Afficher un message',
    famille: 'conditions',
    exercices: [],
    lecon: null,
    faits: 0,
  },
  {
    id: 'variables',
    ordre: 2,
    titre: 'Les variables',
    famille: 'variables',
    // Deux exercices, un seul réussi. Le menu ne lit que leur nombre : un objet
    // partiel suffit, et écrire un Exercice complet ici masquerait cette limite.
    exercices: [{ id: 's1-09' }, { id: 's1-10' }] as unknown as GroupeNotion['exercices'],
    lecon: null,
    faits: 1,
  },
]

describe('Menu', () => {
  it('liste chaque notion avec son avancement', () => {
    render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    expect(screen.getByText('Les variables')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('0 / 0')).toBeInTheDocument()
  })

  it('donne deux liens par notion', () => {
    render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    expect(screen.getAllByRole('link', { name: 'Cours' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Exercices' })).toHaveLength(2)
  })

  it('marque la destination courante', () => {
    render(<Menu groupes={GROUPES} destination={{ vue: 'cours', notion: 'variables' }} />)
    const courant = screen.getByRole('link', { current: 'page' })
    expect(courant).toHaveAccessibleName('Cours')
    expect(courant).toHaveAttribute('href', '/variables/cours')
  })

  it("marque la liste d'exercices quand un exercice de la notion est ouvert", () => {
    // Sinon l'eleve perd de vue ou il se trouve des qu'il ouvre un exercice.
    render(
      <Menu groupes={GROUPES} destination={{ vue: 'exercice', notion: 'variables', numero: 2 }} />,
    )
    expect(screen.getByRole('link', { current: 'page' })).toHaveAccessibleName('Exercices')
  })

  it('navigue sans recharger la page', async () => {
    const pushState = vi.spyOn(history, 'pushState')
    render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
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
    render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    await utilisateur.keyboard('{Control>}')
    await utilisateur.click(screen.getAllByRole('link', { name: 'Cours' })[0]!)
    await utilisateur.keyboard('{/Control}')
    expect(pushState).not.toHaveBeenCalled()
    pushState.mockRestore()
  })

  it('porte la famille de couleur de chaque notion', () => {
    const { container } = render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    expect(container.querySelector('[data-famille="variables"]')).toBeInTheDocument()
    expect(container.querySelector('[data-famille="conditions"]')).toBeInTheDocument()
  })

  it('se laisse nommer aux technologies d assistance', () => {
    render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    expect(screen.getByRole('navigation', { name: /notions/i })).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageCours } from '../../src/ui/PageCours'
import type { GroupeNotion } from '../../src/contenu/notions'
import type { Bloc } from '../../src/contenu/types'
import type { Executeur } from '../../src/execution/executeur'

function groupe(blocs: Bloc[]): GroupeNotion {
  return {
    id: 'variables',
    ordre: 2,
    titre: 'Les variables',
    famille: 'variables',
    exercices: [],
    faits: 0,
    lecon: {
      id: 'c1-variables',
      notion: 'variables',
      ordre: 2,
      titre: 'Les variables',
      dureeMin: 3,
      famille: 'variables',
      blocs,
    },
  }
}

function executeurFactice(partiel: Record<string, unknown> = {}) {
  return {
    executer: vi.fn(async () => ({
      stdout: 'Camille\n',
      erreur: null,
      variables: {},
      dureeMs: 12,
      timeout: false,
      ...partiel,
    })),
  } as unknown as Executeur
}

const CODE = (p: Partial<Extract<Bloc, { type: 'code' }>> = {}): Bloc => ({
  type: 'code',
  legende: 'Ranger',
  python: 'print(prenom)',
  executable: false,
  entrees: [],
  ...p,
})

describe('PageCours', () => {
  it('affiche le titre et la duree de lecture', () => {
    render(<PageCours groupe={groupe([])} executeur={executeurFactice()} />)
    expect(screen.getByRole('heading', { name: 'Les variables' })).toBeInTheDocument()
    expect(screen.getByText(/3 min/)).toBeInTheDocument()
  })

  it('rend un paragraphe avec son formatage', () => {
    const { container } = render(
      <PageCours
        groupe={groupe([{ type: 'paragraphe', texte: 'Une **boîte** nommée.' }])}
        executeur={executeurFactice()}
      />,
    )
    expect(container.querySelector('strong')).toHaveTextContent('boîte')
  })

  it('distingue un bloc attention', () => {
    const { container } = render(
      <PageCours
        groupe={groupe([{ type: 'attention', texte: 'Le signe = range.' }])}
        executeur={executeurFactice()}
      />,
    )
    expect(container.querySelector('.attention')).toHaveTextContent('Le signe = range.')
  })

  it('affiche un bloc code avec sa legende', () => {
    render(<PageCours groupe={groupe([CODE()])} executeur={executeurFactice()} />)
    expect(screen.getByText('Ranger')).toBeInTheDocument()
    expect(screen.getByText(/print\(prenom\)/)).toBeInTheDocument()
  })

  it("n'offre le bac a sable que sur un bloc executable", () => {
    render(<PageCours groupe={groupe([CODE()])} executeur={executeurFactice()} />)
    expect(screen.queryByRole('button', { name: 'Essayer' })).toBeNull()
  })

  it('execute le code du bac a sable et montre la sortie', async () => {
    render(
      <PageCours groupe={groupe([CODE({ executable: true })])} executeur={executeurFactice()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Essayer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exécuter' }))
    expect(await screen.findByText('Camille')).toBeInTheDocument()
  })

  it("dit que rien n'est enregistre dans le bac a sable", async () => {
    render(
      <PageCours groupe={groupe([CODE({ executable: true })])} executeur={executeurFactice()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Essayer' }))
    expect(screen.getByText(/rien n'est enregistré/i)).toBeInTheDocument()
  })

  it('annonce l absence de lecon sans planter', () => {
    const sansLecon = { ...groupe([]), lecon: null }
    render(<PageCours groupe={sansLecon} executeur={executeurFactice()} />)
    expect(screen.getByText(/pas encore de cours/i)).toBeInTheDocument()
  })
})

describe('BacASable', () => {
  it("montre l'erreur Python telle quelle : elle ne quitte pas le navigateur", async () => {
    const executeur = executeurFactice({
      stdout: '',
      erreur: { type: 'NameError', message: "name 'prenom' is not defined", ligne: 1 },
    })
    render(<PageCours groupe={groupe([CODE({ executable: true })])} executeur={executeur} />)
    await userEvent.click(screen.getByRole('button', { name: 'Essayer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exécuter' }))
    expect(await screen.findByText(/NameError/)).toBeInTheDocument()
  })

  it('annonce un depassement de temps', async () => {
    const executeur = executeurFactice({ stdout: '', timeout: true })
    render(<PageCours groupe={groupe([CODE({ executable: true })])} executeur={executeur} />)
    await userEvent.click(screen.getByRole('button', { name: 'Essayer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exécuter' }))
    expect(await screen.findByText(/trop long/i)).toBeInTheDocument()
  })

  it('dit explicitement quand un programme n affiche rien', async () => {
    const executeur = executeurFactice({ stdout: '' })
    render(<PageCours groupe={groupe([CODE({ executable: true })])} executeur={executeur} />)
    await userEvent.click(screen.getByRole('button', { name: 'Essayer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exécuter' }))
    expect(await screen.findByText('(aucune sortie)')).toBeInTheDocument()
  })
})

describe('PageCours — continuité', () => {
  it("mene aux exercices de la notion", () => {
    // Sans cette etape, la page de cours s'arretait : cul-de-sac.
    const avecExercices = {
      ...groupe([]),
      exercices: [{ id: 's1-09' }, { id: 's1-10' }] as unknown as GroupeNotion['exercices'],
    }
    render(<PageCours groupe={avecExercices} executeur={executeurFactice()} />)
    expect(screen.getByRole('link', { name: /2 exercices/ })).toHaveAttribute(
      'href',
      '/variables/exercices',
    )
  })

  it("ne propose rien quand la notion n'a pas encore d'exercice", () => {
    render(<PageCours groupe={groupe([])} executeur={executeurFactice()} />)
    expect(screen.queryByRole('navigation', { name: /précédente et suivante/i })).toBeNull()
  })
})

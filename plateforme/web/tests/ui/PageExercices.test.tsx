import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageExercices } from '../../src/ui/PageExercices'
import type { GroupeNotion } from '../../src/contenu/notions'
import type { Exercice } from '../../src/contenu/types'
import type { Reussite } from '../../src/validation/types'

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

/** Une reussite datee. Par defaut la simple : celle qui vaut une coche. */
function fait(exerciceId: string, verdict: Reussite['verdict'] = 'bleu'): Reussite {
  return { exerciceId, verdict, le: '2026-09-16T14:32:00.000Z' }
}

const GROUPE: GroupeNotion = {
  id: 'variables',
  ordre: 2,
  titre: 'Les variables',
  famille: 'variables',
  chapitre: 'bases',
  lecon: null,
  faits: 1,
  total: 2,
  exercices: [
    ex('s1-09', 'Ranger un prénom', 'ecrire'),
    ex('s1-10', 'Que vaut score ?', 'predire'),
  ],
}

describe('PageExercices', () => {
  it('liste tous les exercices de la notion', () => {
    render(<PageExercices groupe={GROUPE} reussis={[fait('s1-09')]} />)
    expect(screen.getByText('Ranger un prénom')).toBeInTheDocument()
    expect(screen.getByText('Que vaut score ?')).toBeInTheDocument()
  })

  it('marque les exercices reussis', () => {
    const { container } = render(<PageExercices groupe={GROUPE} reussis={[fait('s1-09')]} />)
    expect(container.querySelectorAll('[data-etat="reussi"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-etat="a-faire"]')).toHaveLength(1)
  })

  it("annonce l'etat aux lecteurs d'ecran, pas seulement par la couleur", () => {
    render(<PageExercices groupe={GROUPE} reussis={[fait('s1-09')]} />)
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
    render(<PageExercices groupe={GROUPE} reussis={[fait('s1-09')]} />)
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

describe('PageExercices — continuité', () => {
  it('ramene au cours de la notion', () => {
    const avecLecon = {
      ...GROUPE,
      lecon: {
        id: 'c1-variables',
        notion: 'variables',
        ordre: 2,
        titre: 'Les variables',
        dureeMin: 3,
        famille: 'variables' as const,
        blocs: [],
      },
    }
    render(<PageExercices groupe={avecLecon} reussis={[]} />)
    const pied = screen.getByRole('navigation', { name: /précédente et suivante/i })
    expect(within(pied).getByRole('link', { name: /Les variables/ })).toHaveAttribute(
      'href',
      '/variables/cours',
    )
  })

  it("ne propose la notion suivante qu'une fois la notion terminee", () => {
    const suivante = { ...GROUPE, id: 'types', titre: 'Types et conversion' }

    const { unmount } = render(
      <PageExercices groupe={GROUPE} reussis={[fait('s1-09')]} suivante={suivante} />,
    )
    expect(screen.queryByRole('link', { name: /Types et conversion/ })).toBeNull()
    unmount()

    render(
      <PageExercices
        groupe={{ ...GROUPE, faits: 2 }}
        reussis={[fait('s1-09'), fait('s1-10')]}
        suivante={suivante}
      />,
    )
    expect(screen.getByRole('link', { name: /Types et conversion/ })).toHaveAttribute(
      'href',
      '/types/cours',
    )
  })
})

describe('PageExercices — obligatoires et facultatifs', () => {
  function avecBonus(): GroupeNotion {
    return {
      ...GROUPE,
      faits: 1,
      total: 2,
      exercices: [
        ex('s1-09', 'Ranger un prénom', 'ecrire'),
        ex('s1-10', 'Que vaut score ?', 'predire'),
        { ...ex('s1-15', 'Un renfort', 'debug'), obligatoire: false },
        { ...ex('s1-17', 'Un bonus', 'debug'), obligatoire: false, niveau: 'expert' as const },
      ],
    }
  }

  it("ne compte que les obligatoires dans l'avancement", () => {
    // ADR-004 : un expert n'est jamais compte dans la progression affichee.
    render(<PageExercices groupe={avecBonus()} reussis={[fait('s1-09')]} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('sépare les facultatifs du chemin obligatoire', () => {
    render(<PageExercices groupe={avecBonus()} reussis={[]} />)
    const bloc = screen.getByRole('heading', { name: /aller plus loin/i }).parentElement!
    expect(within(bloc).getByRole('link', { name: /Un renfort/ })).toBeInTheDocument()
    expect(within(bloc).getByRole('link', { name: /Un bonus/ })).toBeInTheDocument()
    expect(within(bloc).queryByRole('link', { name: /Ranger un prénom/ })).toBeNull()
  })

  it('étiquette les experts, pas les renforts', () => {
    render(<PageExercices groupe={avecBonus()} reussis={[]} />)
    expect(screen.getAllByText('Bonus')).toHaveLength(1)
  })

  it("garde le numéro d'URL de l'exercice, pas son rang affiché", () => {
    // Le renfort est le 3e du tableau publie : son URL doit rester /…/3.
    render(<PageExercices groupe={avecBonus()} reussis={[]} />)
    expect(screen.getByRole('link', { name: /Un renfort/ })).toHaveAttribute(
      'href',
      '/variables/exercices/3',
    )
  })

  it('ne montre aucun bloc facultatif quand il n y en a pas', () => {
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    expect(screen.queryByRole('heading', { name: /aller plus loin/i })).toBeNull()
  })
})

describe('PageExercices — les deux niveaux de réussite', () => {
  it('une seule coche quand ça marche', () => {
    const { container } = render(<PageExercices groupe={GROUPE} reussis={[fait('s1-09')]} />)
    const coches = container.querySelector('.coches')!
    expect(coches).toHaveAttribute('data-niveau', '1')
    expect(coches.querySelectorAll('svg')).toHaveLength(1)
  })

  it('deux coches quand la méthode est la bonne', () => {
    const { container } = render(
      <PageExercices groupe={GROUPE} reussis={[fait('s1-09', 'vert')]} />,
    )
    const coches = container.querySelector('.coches')!
    expect(coches).toHaveAttribute('data-niveau', '2')
    expect(coches.querySelectorAll('svg')).toHaveLength(2)
  })

  it('dit la différence aux lecteurs d écran, pas seulement par le nombre de coches', () => {
    render(<PageExercices groupe={GROUPE} reussis={[fait('s1-09', 'vert')]} />)
    expect(screen.getByText('réussi, méthode maîtrisée')).toBeInTheDocument()
  })

  it('compte une réussite simple dans l avancement comme une autre', () => {
    // Une coche suffit a valider : la seconde recompense, elle ne conditionne rien.
    render(<PageExercices groupe={GROUPE} reussis={[fait('s1-09')]} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })
})

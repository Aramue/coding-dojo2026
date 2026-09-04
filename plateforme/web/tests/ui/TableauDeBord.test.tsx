import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TableauDeBord } from '../../src/ui/TableauDeBord'
import type { LigneEleve } from '../../src/prof/seance'

const NOTIONS = [
  { id: 'afficher', ordre: 1, titre: 'Afficher un message', famille: 'conditions', chapitre: 'bases' },
  { id: 'saisie', ordre: 4, titre: 'Demander une information', famille: 'operateurs', chapitre: 'bases' },
]

function ex(id: string, notion: string, titre: string, obligatoire = true) {
  return {
    id,
    concept: 'print',
    notion,
    famille: 'conditions',
    seance: 1,
    niveau: obligatoire ? 'normal' : 'expert',
    type: 'ecrire',
    titre,
    obligatoire,
    enonce: '',
    depart: '',
    indices: [],
    tests: [],
  }
}

const EXERCICES = [
  ex('s1-02', 'afficher', 'Ton premier programme'),
  ex('s1-29', 'saisie', "L'âge qui refuse de s'additionner"),
  ex('s1-31', 'saisie', 'Deux questions, une fiche'),
  ex('s1-33', 'saisie', "L'ordre des questions", false),
]

function ligne(surcharge: Partial<LigneEleve> = {}): LigneEleve {
  return {
    code_acces: 'DOJO-K7M2',
    exercice_id: 's1-02',
    statut: 'en_cours',
    echecs_consecutifs: 0,
    inactif_depuis_s: 0,
    dernier_type_erreur: null,
    reussis: [],
    ...surcharge,
  }
}

/** Sert le contenu publié et la séance, chacun sur sa route. */
function poserLeReseau(eleves: unknown[], seance: { ok?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('notions')) return { ok: true, json: async () => NOTIONS }
      if (url.includes('prof/seance')) {
        return { ok: seance.ok ?? true, status: 200, json: async () => ({ eleves }) }
      }
      return { ok: true, json: async () => EXERCICES }
    }),
  )
}

async function rendre(eleves: unknown[]) {
  poserLeReseau(eleves)
  render(<TableauDeBord codeProf="code-prof-test" />)
  await screen.findByRole('heading', { name: /séance en cours/i })
}

beforeEach(() => vi.unstubAllGlobals())

describe('TableauDeBord — accords', () => {
  it('accorde le singulier', async () => {
    await rendre([ligne()])
    expect(screen.getByText('1 élève connecté')).toBeInTheDocument()
  })

  it('accorde le pluriel', async () => {
    await rendre([ligne(), ligne({ code_acces: 'DOJO-DEUX' })])
    expect(screen.getByText('2 élèves connectés')).toBeInTheDocument()
  })

  it("accorde aussi le compte d'echecs", async () => {
    await rendre([ligne({ statut: 'bloque', echecs_consecutifs: 1 })])
    expect(screen.getByText('1 échec')).toBeInTheDocument()
  })
})

describe('TableauDeBord — ce que le professeur lit', () => {
  it("remplace l'identifiant par le titre de l'exercice et sa notion", async () => {
    await rendre([ligne({ exercice_id: 's1-29' })])
    await waitFor(() =>
      expect(screen.getByText("L'âge qui refuse de s'additionner")).toBeInTheDocument(),
    )
    expect(screen.getByText('Demander une information')).toBeInTheDocument()
  })

  it("retombe sur l'identifiant tant que le contenu n'est pas la", async () => {
    // Le contenu publie peut manquer : le tableau doit rester utilisable.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('prof/seance')) {
          return { ok: true, json: async () => ({ eleves: [ligne({ exercice_id: 's1-29' })] }) }
        }
        throw new Error('contenu indisponible')
      }),
    )
    render(<TableauDeBord codeProf="code-prof-test" />)
    expect(await screen.findByText('s1-29')).toBeInTheDocument()
  })

  it('ne compte que les obligatoires dans un avancement', async () => {
    // s1-33 est un bonus : il ne doit ni compter, ni gonfler le total.
    await rendre([ligne({ reussis: ['s1-02', 's1-33'] })])
    await waitFor(() => expect(screen.getByText('1 / 3 réussis')).toBeInTheDocument())
  })

  it("n'ecrit jamais « Bloqué 0 min »", async () => {
    await rendre([ligne({ statut: 'bloque', echecs_consecutifs: 3, inactif_depuis_s: 8 })])
    expect(screen.getByText('Bloqué')).toBeInTheDocument()
    expect(screen.queryByText(/0 min/)).toBeNull()
  })

  it('donne le delai quand il compte', async () => {
    await rendre([ligne({ statut: 'bloque', echecs_consecutifs: 4, inactif_depuis_s: 420 })])
    expect(screen.getByText(/Bloqué · 7 min/)).toBeInTheDocument()
  })
})

describe('TableauDeBord — ce qui bloque plusieurs eleves', () => {
  const DEUX_BLOQUES = [
    ligne({
      code_acces: 'DOJO-AAAA',
      statut: 'bloque',
      exercice_id: 's1-29',
      echecs_consecutifs: 3,
      dernier_type_erreur: 'TypeError',
    }),
    ligne({
      code_acces: 'DOJO-BBBB',
      statut: 'bloque',
      exercice_id: 's1-29',
      echecs_consecutifs: 4,
      dernier_type_erreur: 'TypeError',
    }),
  ]

  it("nomme l'exercice, compte les eleves et cite leurs codes", async () => {
    await rendre(DEUX_BLOQUES)
    const bloc = await screen.findByRole('region', { name: /bloque plusieurs/i })
    expect(within(bloc).getByText('2')).toBeInTheDocument()
    expect(within(bloc).getByText("L'âge qui refuse de s'additionner")).toBeInTheDocument()
    expect(within(bloc).getByText(/DOJO-AAAA · DOJO-BBBB/)).toBeInTheDocument()
  })

  it("remonte l'erreur la plus frequente", async () => {
    await rendre(DEUX_BLOQUES)
    const bloc = await screen.findByRole('region', { name: /bloque plusieurs/i })
    expect(within(bloc).getByText(/TypeError/)).toBeInTheDocument()
  })

  it('ne dit rien quand un seul eleve bloque', async () => {
    await rendre([DEUX_BLOQUES[0]!])
    expect(screen.queryByRole('region', { name: /bloque plusieurs/i })).toBeNull()
  })
})

describe('TableauDeBord — vue d ensemble', () => {
  it('compte les eleves par statut', async () => {
    await rendre([
      ligne({ code_acces: 'DOJO-A', statut: 'bloque' }),
      ligne({ code_acces: 'DOJO-B', statut: 'inactif', inactif_depuis_s: 700 }),
      ligne({ code_acces: 'DOJO-C' }),
      ligne({ code_acces: 'DOJO-D' }),
    ])
    const vue = await screen.findByRole('region', { name: /vue d'ensemble/i })
    expect(within(vue).getByText('bloqués').parentElement).toHaveTextContent('1 bloqués')
    expect(within(vue).getByText('en cours').parentElement).toHaveTextContent('2 en cours')
  })

  it('pose un trait par eleve sur la ligne de repartition', async () => {
    // Un trait chacun, pose la ou l'eleve en est : c'est l'ecart qui se pilote,
    // et une moyenne l'effacerait.
    poserLeReseau([
      ligne({ code_acces: 'DOJO-A', reussis: [] }),
      ligne({ code_acces: 'DOJO-B', reussis: ['s1-02'] }),
      ligne({ code_acces: 'DOJO-C', reussis: ['s1-02', 's1-29', 's1-31'] }),
    ])
    const { container } = render(<TableauDeBord codeProf="code-prof-test" />)
    await waitFor(() => expect(container.querySelectorAll('.etalement__trait')).toHaveLength(3))
    expect(screen.getByText(/médiane/)).toHaveTextContent('médiane 1 sur 3 obligatoires')
  })

  it('ne montre aucune vue d ensemble sur une salle vide', async () => {
    await rendre([])
    expect(screen.queryByRole('region', { name: /vue d'ensemble/i })).toBeNull()
  })
})

describe('TableauDeBord — le pouls', () => {
  it('dit que les donnees viennent d arriver', async () => {
    await rendre([ligne()])
    expect(await screen.findByText(/à l'instant|il y a \d+ s/)).toBeInTheDocument()
  })

  it('dit que la liaison est rompue plutot que de laisser croire au calme', async () => {
    poserLeReseau([], { ok: false })
    render(<TableauDeBord codeProf="code-prof-test" />)
    expect(await screen.findByText('plus de données')).toBeInTheDocument()
  })
})

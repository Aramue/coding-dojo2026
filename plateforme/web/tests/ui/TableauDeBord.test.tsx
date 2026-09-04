import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

/** Une reussite, verte par defaut : deux coches. */
function reussi(id: string, verdict: 'vert' | 'bleu' = 'vert') {
  return { exercice_id: id, verdict }
}

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
      if (url.includes('chapitres') || url.includes('lecons')) {
        return { ok: true, json: async () => [] }
      }
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

  it("dit depuis quand un élève en cours n'a rien soumis", async () => {
    // La jauge dit déjà « 1/3 » : le répéter ici n'ajoute rien. Le délai, lui,
    // distingue celui qui vient de valider de celui qui sèche en silence sans
    // avoir encore atteint le seuil d'inactivité.
    await rendre([ligne({ inactif_depuis_s: 240 })])
    expect(await screen.findByText('dernière soumission il y a 4 min')).toBeInTheDocument()
  })

  it('le dit autrement quand la soumission est toute fraîche', async () => {
    await rendre([ligne({ inactif_depuis_s: 5 })])
    expect(await screen.findByText('vient de soumettre')).toBeInTheDocument()
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
    const comptes = await screen.findByLabelText('Répartition de la classe')
    expect(within(comptes).getByText('bloqués').parentElement).toHaveTextContent('1 bloqués')
    expect(within(comptes).getByText('en cours').parentElement).toHaveTextContent('2 en cours')
  })

  it('pose un trait par eleve sur la ligne de repartition', async () => {
    // Un trait chacun, pose la ou l'eleve en est : c'est l'ecart qui se pilote,
    // et une moyenne l'effacerait.
    poserLeReseau([
      ligne({ code_acces: 'DOJO-A', reussis: [] }),
      ligne({ code_acces: 'DOJO-B', reussis: [{ exercice_id: 's1-02', verdict: 'vert' as const }] }),
      ligne({ code_acces: 'DOJO-C', reussis: [{ exercice_id: 's1-02', verdict: 'vert' as const }, { exercice_id: 's1-29', verdict: 'vert' as const }, { exercice_id: 's1-31', verdict: 'vert' as const }] }),
    ])
    const { container } = render(<TableauDeBord codeProf="code-prof-test" />)
    await waitFor(() => expect(container.querySelectorAll('.etalement__trait')).toHaveLength(3))
    expect(screen.getByText(/médiane/)).toHaveTextContent('médiane 1 sur 3 obligatoires')
  })

  it('ne montre ni comptes ni avancement sur une salle vide', async () => {
    await rendre([])
    expect(screen.queryByLabelText('Répartition de la classe')).toBeNull()
    expect(screen.queryByRole('region', { name: /Avancement de la classe/i })).toBeNull()
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

describe('TableauDeBord — deplier un eleve', () => {
  const AVEC_PARCOURS = ligne({
    prenom: 'Enzo',
    nom: 'Poupard',
    exercice_id: 's1-31',
    reussis: [reussi('s1-02'), reussi('s1-29', 'bleu')],
  })

  async function deplier() {
    await userEvent.click(await screen.findByRole('button', { name: /Déplier le parcours/ }))
  }

  it('ne montre rien tant qu on n a pas deplie', async () => {
    await rendre([AVEC_PARCOURS])
    expect(screen.queryByText('Ton premier programme')).toBeNull()
  })

  it("montre le parcours, notion par notion", async () => {
    await rendre([AVEC_PARCOURS])
    await deplier()
    // Le titre porte desormais le compte de la notion a cote de son nom.
    expect(screen.getByRole('heading', { name: /Afficher un message/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Demander une information/ })).toBeInTheDocument()
  })

  it("marque l'exercice en cours", async () => {
    await rendre([AVEC_PARCOURS])
    await deplier()
    const courant = document.querySelector('.etape[data-courant="true"]')
    expect(courant).toHaveTextContent('Deux questions, une fiche')
    expect(courant).toHaveTextContent('en ce moment')
  })

  it('donne deux coches au vert, une au bleu', async () => {
    await rendre([AVEC_PARCOURS])
    await deplier()
    expect(document.querySelector('.etape[data-coches="2"]')).toHaveTextContent(
      'Ton premier programme',
    )
    expect(document.querySelector('.etape[data-coches="1"]')).toHaveTextContent(
      "L'âge qui refuse de s'additionner",
    )
  })

  it("annonce l'état aux lecteurs d'écran, pas seulement par des coches", async () => {
    await rendre([AVEC_PARCOURS])
    await deplier()
    expect(screen.getByText('réussi, méthode maîtrisée')).toBeInTheDocument()
    expect(screen.getByText('réussi')).toBeInTheDocument()
  })

  it('se replie', async () => {
    await rendre([AVEC_PARCOURS])
    await deplier()
    await userEvent.click(screen.getByRole('button', { name: /Replier le parcours/ }))
    expect(screen.queryByText('Ton premier programme')).toBeNull()
  })

  it("n'affiche jamais ce que l'élève a tapé", async () => {
    // ADR-001 : le code s'execute dans le navigateur de l'eleve et n'en sort
    // jamais. Ce panneau dit OU il en est, jamais CE QU'IL ECRIT — et l'API ne
    // transporte rien d'autre que des identifiants et des verdicts.
    await rendre([AVEC_PARCOURS])
    await deplier()
    const texte = document.body.textContent ?? ''
    expect(texte).not.toMatch(/print\(|input\(|=/)
    expect(screen.getByText(/ne quitte jamais son navigateur/)).toBeInTheDocument()
  })
})

describe("TableauDeBord — ouvrir l'exercice depuis le parcours", () => {
  it("ouvre l'aperçu sur l'exercice cliqué", async () => {
    // Le professeur sait qu'on bute sur « L'age qui refuse de s'additionner » ;
    // sans ce clic il ne peut pas relire ce que l'enonce demande.
    const onApercu = vi.fn()
    poserLeReseau([ligne({ prenom: 'Enzo', nom: 'Poupard', exercice_id: 's1-29' })])
    render(<TableauDeBord codeProf="code-prof-test" onApercu={onApercu} />)

    await userEvent.click(await screen.findByRole('button', { name: /Déplier le parcours/ }))
    await userEvent.click(
      screen.getByRole('button', { name: /L'âge qui refuse de s'additionner/ }),
    )

    // s1-29 est le premier exercice de « saisie » dans le contenu de test.
    expect(onApercu).toHaveBeenCalledWith({ vue: 'exercice', notion: 'saisie', numero: 1 })
  })

  it("n'offre pas le clic quand personne n'écoute", async () => {
    poserLeReseau([ligne({ prenom: 'Enzo', exercice_id: 's1-29' })])
    render(<TableauDeBord codeProf="code-prof-test" />)
    await userEvent.click(await screen.findByRole('button', { name: /Déplier le parcours/ }))
    expect(
      screen.getByRole('button', { name: /L'âge qui refuse de s'additionner/ }),
    ).toBeDisabled()
  })
})

describe('TableauDeBord — les jauges', () => {
  it("montre la progression de chaque eleve, comme il la voit lui-meme", async () => {
    // Le chiffre seul se lit ligne par ligne ; la barre se lit en balayant la
    // colonne, et c'est ainsi qu'on repere qui traine.
    await rendre([
      ligne({ code_acces: 'DOJO-A', prenom: 'Enzo', reussis: [reussi('s1-02')] }),
      ligne({ code_acces: 'DOJO-B', prenom: 'Iziz', reussis: [] }),
    ])
    const jauges = await waitFor(() => {
      const trouvees = screen.getAllByRole('progressbar', { name: /exercices réussis sur/ })
      expect(trouvees).toHaveLength(2)
      return trouvees
    })
    expect(jauges[0]).toHaveAttribute('aria-valuenow', '1')
    expect(jauges[0]).toHaveAttribute('aria-valuemax', '3')
    expect(jauges[1]).toHaveAttribute('aria-valuenow', '0')
  })

  it('ne compte que les obligatoires, comme chez l eleve', async () => {
    // s1-33 est un bonus : il ne bouge ni la barre ni le total.
    await rendre([ligne({ prenom: 'Enzo', reussis: [reussi('s1-02'), reussi('s1-33')] })])
    const jauge = await screen.findByRole('progressbar', { name: /exercices réussis sur/ })
    expect(jauge).toHaveAttribute('aria-valuenow', '1')
    expect(jauge).toHaveAttribute('aria-valuemax', '3')
  })

  it('donne une jauge par notion dans le parcours déplié', async () => {
    await rendre([ligne({ prenom: 'Enzo', reussis: [reussi('s1-02')] })])
    await userEvent.click(await screen.findByRole('button', { name: /Déplier le parcours/ }))
    // Une pour la ligne, une par notion qui compte des obligatoires.
    const jauges = screen.getAllByRole('progressbar', { name: /exercices réussis sur/ })
    expect(jauges.length).toBeGreaterThan(1)
    expect(screen.getByRole('heading', { name: 'Afficher un message1/1' })).toBeInTheDocument()
  })
})

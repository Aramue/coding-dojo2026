import { describe, expect, it } from 'vitest'
import {
  blocagesCollectifs,
  nommer,
  obligatoires,
  parcoursEleve,
  reperes,
  synthese,
  type LigneEleve,
} from '../../src/prof/seance'
import { grouper } from '../../src/contenu/notions'
import type { Exercice, Notion } from '../../src/contenu/types'

/** Une réussite, verte par défaut : deux coches. */
function reussi(id: string, verdict: 'vert' | 'bleu' = 'vert') {
  return { exercice_id: id, verdict }
}

function ligne(surcharge: Partial<LigneEleve> = {}): LigneEleve {
  return {
    code_acces: 'DOJO-K7M2',
    exercice_id: 's1-01',
    statut: 'en_cours',
    echecs_consecutifs: 0,
    inactif_depuis_s: 12,
    dernier_type_erreur: null,
    reussis: [],
    ...surcharge,
  }
}

function ex(id: string, surcharge: Partial<Exercice> = {}): Exercice {
  return {
    id,
    concept: 'print',
    notion: 'afficher',
    famille: 'conditions',
    seance: 1,
    niveau: 'normal',
    type: 'ecrire',
    titre: `Titre de ${id}`,
    obligatoire: true,
    enonce: '',
    depart: '',
    indices: [],
    tests: [],
    ...surcharge,
  }
}

const NOTIONS: Notion[] = [
  { id: 'afficher', ordre: 1, titre: 'Afficher un message', famille: 'conditions', chapitre: 'bases' },
  { id: 'saisie', ordre: 4, titre: 'Demander une information', famille: 'operateurs', chapitre: 'bases' },
]

describe('reperes', () => {
  it("remplace l'identifiant par le titre et le nom de la notion", () => {
    const table = reperes([ex('s1-29', { notion: 'saisie', titre: "L'âge qui refuse" })], NOTIONS)
    expect(table.get('s1-29')).toEqual({
      titre: "L'âge qui refuse",
      notion: 'Demander une information',
    })
  })

  it("retombe sur l'identifiant de notion quand elle n'est pas publiée", () => {
    // Un exercice dont la notion manque doit rester affichable : le tableau du
    // professeur ne doit jamais perdre une ligne parce qu'une donnee manque.
    const table = reperes([ex('s1-01', { notion: 'inconnue' })], NOTIONS)
    expect(table.get('s1-01')?.notion).toBe('inconnue')
  })

  it("ne connait pas les exercices qui n'existent pas", () => {
    expect(reperes([ex('s1-01')], NOTIONS).get('s9-99')).toBeUndefined()
  })
})

describe('obligatoires', () => {
  it('écarte les renforts et les bonus', () => {
    const liste = [
      ex('s1-01'),
      ex('s1-15', { obligatoire: false }),
      ex('s1-17', { obligatoire: false, niveau: 'expert' }),
    ]
    expect([...obligatoires(liste)]).toEqual(['s1-01'])
  })
})

describe('synthese', () => {
  const comptes = new Set(['s1-01', 's1-02', 's1-03', 's1-04'])

  it('compte les élèves par statut', () => {
    const s = synthese(
      [
        ligne({ statut: 'bloque' }),
        ligne({ statut: 'bloque' }),
        ligne({ statut: 'inactif' }),
        ligne({ statut: 'en_cours' }),
      ],
      comptes,
    )
    expect([s.bloques, s.inactifs, s.enCours]).toEqual([2, 1, 1])
  })

  it('ne compte que les obligatoires dans la mediane', () => {
    // ADR-004 : un renfort ou un bonus n'entre jamais dans la progression.
    const s = synthese([ligne({ reussis: [reussi('s1-01'), reussi('s1-15'), reussi('s1-17')] })], comptes)
    expect(s.mediane).toBe(1)
    expect(s.total).toBe(4)
  })

  it('prend la valeur centrale, pas la moyenne', () => {
    // Trois eleves a 0, 1 et 3 : la moyenne dirait 1,33 et arrondirait a 1 par
    // hasard. Sur une classe ou trois ont fini et six n'ont rien commence,
    // ==la moyenne rassure et la mediane dit vrai==.
    const s = synthese(
      [
        ligne({ reussis: [reussi('s1-01'), reussi('s1-02'), reussi('s1-03')] }),
        ligne({ reussis: [] }),
        ligne({ reussis: [reussi('s1-01')] }),
      ],
      comptes,
    )
    expect(s.mediane).toBe(1)
  })

  it('prend la moyenne des deux valeurs centrales sur un effectif pair', () => {
    const s = synthese(
      [
        ligne({ reussis: [] }),
        ligne({ reussis: [reussi('s1-01')] }),
        ligne({ reussis: [reussi('s1-01'), reussi('s1-02')] }),
        ligne({ reussis: [reussi('s1-01'), reussi('s1-02'), reussi('s1-03'), reussi('s1-04')] }),
      ],
      comptes,
    )
    expect(s.mediane).toBe(2)
  })

  it('ne divise pas par zéro sur une salle vide', () => {
    expect(synthese([], comptes).mediane).toBe(0)
  })
})

describe('blocagesCollectifs', () => {
  it('regroupe les élèves bloqués sur le même exercice', () => {
    const blocages = blocagesCollectifs([
      ligne({ code_acces: 'DOJO-AAAA', statut: 'bloque', exercice_id: 's1-29' }),
      ligne({ code_acces: 'DOJO-BBBB', statut: 'bloque', exercice_id: 's1-29' }),
    ])
    expect(blocages).toHaveLength(1)
    expect(blocages[0]!.eleves).toEqual(['DOJO-AAAA', 'DOJO-BBBB'])
  })

  it("ne signale pas un eleve seul : celui-la, on va le voir", () => {
    const blocages = blocagesCollectifs([
      ligne({ statut: 'bloque', exercice_id: 's1-29' }),
      ligne({ statut: 'bloque', exercice_id: 's1-31' }),
    ])
    expect(blocages).toEqual([])
  })

  it("ignore ceux qui ne sont pas bloques, meme sur le meme exercice", () => {
    const blocages = blocagesCollectifs([
      ligne({ statut: 'bloque', exercice_id: 's1-29' }),
      ligne({ statut: 'en_cours', exercice_id: 's1-29' }),
      ligne({ statut: 'inactif', exercice_id: 's1-29' }),
    ])
    expect(blocages).toEqual([])
  })

  it('met en tête celui qui bloque le plus de monde', () => {
    const blocages = blocagesCollectifs([
      ligne({ statut: 'bloque', exercice_id: 's1-31' }),
      ligne({ statut: 'bloque', exercice_id: 's1-31' }),
      ligne({ statut: 'bloque', exercice_id: 's1-29' }),
      ligne({ statut: 'bloque', exercice_id: 's1-29' }),
      ligne({ statut: 'bloque', exercice_id: 's1-29' }),
    ])
    expect(blocages.map((b) => b.exerciceId)).toEqual(['s1-29', 's1-31'])
  })

  it('classe les erreurs de la plus fréquente à la moins fréquente', () => {
    const blocages = blocagesCollectifs([
      ligne({ statut: 'bloque', exercice_id: 's1-29', dernier_type_erreur: 'NameError' }),
      ligne({ statut: 'bloque', exercice_id: 's1-29', dernier_type_erreur: 'TypeError' }),
      ligne({ statut: 'bloque', exercice_id: 's1-29', dernier_type_erreur: 'TypeError' }),
    ])
    expect(blocages[0]!.erreurs).toEqual(['TypeError', 'NameError'])
  })

  it("n'invente pas d'erreur quand aucune n'a ete remontee", () => {
    const blocages = blocagesCollectifs([
      ligne({ statut: 'bloque', exercice_id: 's1-29', dernier_type_erreur: null }),
      ligne({ statut: 'bloque', exercice_id: 's1-29', dernier_type_erreur: null }),
    ])
    expect(blocages[0]!.erreurs).toEqual([])
  })
})

describe('nommer', () => {
  it("abrege le nom de famille : la ligne reste lisible, la personne reconnaissable", () => {
    expect(nommer(ligne({ prenom: 'Camille', nom: 'Rey' }))).toBe('Camille R.')
  })

  it('se contente du prenom quand il n y a pas de nom', () => {
    expect(nommer(ligne({ prenom: 'Camille', nom: '' }))).toBe('Camille')
  })

  it('retombe sur le code tant que rien n a ete saisi', () => {
    expect(nommer(ligne({ code_acces: 'DOJO-K7M2' }))).toBe('DOJO-K7M2')
  })

  it("ignore une saisie faite d'espaces", () => {
    expect(nommer(ligne({ code_acces: 'DOJO-K7M2', prenom: '  ', nom: ' ' }))).toBe('DOJO-K7M2')
  })

  it('met l initiale en capitale', () => {
    expect(nommer(ligne({ prenom: 'Enzo', nom: 'poupard' }))).toBe('Enzo P.')
  })
})

describe('synthese — ceux qui n ont pas commence', () => {
  it('les compte a part', () => {
    const s = synthese(
      [ligne({ statut: 'pas_commence' }), ligne({ statut: 'pas_commence' }), ligne()],
      new Set(['s1-01']),
    )
    expect(s.pasCommence).toBe(2)
    expect(s.enCours).toBe(1)
  })
})

describe('blocagesCollectifs — un inscrit sans tentative', () => {
  it("n'entre dans aucun groupe : il n'est bloque nulle part", () => {
    const blocages = blocagesCollectifs([
      ligne({ statut: 'pas_commence', exercice_id: null }),
      ligne({ statut: 'pas_commence', exercice_id: null }),
    ])
    expect(blocages).toEqual([])
  })

  it('nomme les eleves du bandeau plutot que de citer leurs codes', () => {
    const blocages = blocagesCollectifs([
      ligne({ statut: 'bloque', exercice_id: 's1-29', prenom: 'Camille', nom: 'Rey' }),
      ligne({ statut: 'bloque', exercice_id: 's1-29', prenom: 'Enzo', nom: 'Poupard' }),
    ])
    expect(blocages[0]!.eleves).toEqual(['Camille R.', 'Enzo P.'])
  })
})

describe('parcoursEleve', () => {
  const EXERCICES = [
    ex('s1-01', { notion: 'afficher', titre: 'Dire bonjour' }),
    ex('s1-02', { notion: 'afficher', titre: 'Ton premier programme' }),
    ex('s1-31', { notion: 'saisie', titre: 'Deux questions, une fiche' }),
    ex('s1-33', { notion: 'saisie', titre: "L'ordre des questions", obligatoire: false }),
  ]

  const ELEVE = ligne({
    exercice_id: 's1-31',
    reussis: [
      { exercice_id: 's1-01', verdict: 'vert' },
      { exercice_id: 's1-02', verdict: 'bleu' },
    ],
  })

  it('range les exercices par notion, dans l ordre du parcours', () => {
    const parcours = parcoursEleve(ELEVE, EXERCICES, NOTIONS)
    expect(parcours.map((n) => n.titre)).toEqual([
      'Afficher un message',
      'Demander une information',
    ])
  })

  it('donne deux coches au vert, une au bleu, aucune au reste', () => {
    const etapes = parcoursEleve(ELEVE, EXERCICES, NOTIONS)[0]!.etapes
    expect(etapes.map((e) => e.coches)).toEqual([2, 1])
    expect(parcoursEleve(ELEVE, EXERCICES, NOTIONS)[1]!.etapes[0]!.coches).toBe(0)
  })

  it('marque l exercice en cours : c est ce qu on vient chercher', () => {
    const parcours = parcoursEleve(ELEVE, EXERCICES, NOTIONS)
    const courants = parcours.flatMap((n) => n.etapes.filter((e) => e.courant))
    expect(courants.map((e) => e.id)).toEqual(['s1-31'])
  })

  it('distingue les facultatifs sans les cacher', () => {
    const saisie = parcoursEleve(ELEVE, EXERCICES, NOTIONS)[1]!
    expect(saisie.etapes.map((e) => e.obligatoire)).toEqual([true, false])
  })

  it('ne montre pas une notion sans exercice', () => {
    const parcours = parcoursEleve(ELEVE, [EXERCICES[0]!], NOTIONS)
    expect(parcours.map((n) => n.id)).toEqual(['afficher'])
  })

  it('ne marque rien pour un eleve qui n a rien soumis', () => {
    const parcours = parcoursEleve(
      ligne({ exercice_id: null, statut: 'pas_commence', reussis: [] }),
      EXERCICES,
      NOTIONS,
    )
    const toutes = parcours.flatMap((n) => n.etapes)
    expect(toutes.every((e) => e.coches === 0 && !e.courant)).toBe(true)
  })

  it("ne transporte que des identifiants et des verdicts", () => {
    // Garde-fou explicite : ce que l'eleve tape ne doit jamais atteindre cette
    // vue. La forme des etapes est fixee ici pour qu'un champ ajoute par
    // inadvertance fasse echouer le test plutot que d'arriver a l'ecran.
    const etape = parcoursEleve(ELEVE, EXERCICES, NOTIONS)[0]!.etapes[0]!
    expect(Object.keys(etape).sort()).toEqual([
      'coches',
      'courant',
      'id',
      'numero',
      'obligatoire',
      'titre',
    ])
  })
})

describe('parcoursEleve — ouvrir un exercice', () => {
  it('numerote chaque exercice comme l URL eleve le fait', () => {
    // Le rang court sur TOUS les exercices de la notion, facultatifs compris.
    const exercices = [
      ex('s1-01', { notion: 'afficher' }),
      ex('s1-02', { notion: 'afficher', obligatoire: false }),
      ex('s1-03', { notion: 'afficher' }),
    ]
    const etapes = parcoursEleve(ligne(), exercices, NOTIONS)[0]!.etapes
    expect(etapes.map((e) => e.numero)).toEqual([1, 2, 3])
  })

  it('repart de 1 dans chaque notion', () => {
    const exercices = [
      ex('s1-01', { notion: 'afficher' }),
      ex('s1-31', { notion: 'saisie' }),
    ]
    const parcours = parcoursEleve(ligne(), exercices, NOTIONS)
    expect(parcours.map((n) => n.etapes[0]!.numero)).toEqual([1, 1])
  })
})

describe('parcoursEleve — parité avec la numérotation élève', () => {
  it("numérote comme grouper(), sinon l'aperçu ouvrirait le mauvais exercice", () => {
    // Les deux parcourent `exercices` dans l'ordre de publication, filtré par
    // notion. ==Si l'un des deux se met a trier, le lien du tableau de bord
    // pointe sur un autre exercice sans que rien ne le signale.==
    const exercices = [
      ex('s1-27', { notion: 'saisie' }),
      ex('s1-28', { notion: 'saisie', obligatoire: false }),
      ex('s1-29', { notion: 'saisie' }),
      ex('s1-01', { notion: 'afficher' }),
    ]
    const coteProf = parcoursEleve(ligne(), exercices, NOTIONS).find((n) => n.id === 'saisie')!
    const coteEleve = grouper(NOTIONS, exercices, [], []).find((g) => g.id === 'saisie')!

    expect(coteProf.etapes.map((e) => e.id)).toEqual(coteEleve.exercices.map((e) => e.id))
    expect(coteProf.etapes.map((e) => e.numero)).toEqual(
      coteEleve.exercices.map((_, index) => index + 1),
    )
  })
})

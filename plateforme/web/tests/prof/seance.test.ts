import { describe, expect, it } from 'vitest'
import {
  blocagesCollectifs,
  nommer,
  obligatoires,
  reperes,
  synthese,
  type LigneEleve,
} from '../../src/prof/seance'
import type { Exercice, Notion } from '../../src/contenu/types'

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

  it('ne compte que les obligatoires dans un avancement', () => {
    // ADR-004 : un renfort ou un bonus n'entre jamais dans la progression.
    const s = synthese([ligne({ reussis: ['s1-01', 's1-15', 's1-17'] })], comptes)
    expect(s.avancements).toEqual([1])
    expect(s.total).toBe(4)
  })

  it('rend la distribution triée, pas seulement sa médiane', () => {
    const s = synthese(
      [
        ligne({ reussis: ['s1-01', 's1-02', 's1-03'] }),
        ligne({ reussis: [] }),
        ligne({ reussis: ['s1-01'] }),
      ],
      comptes,
    )
    expect(s.avancements).toEqual([0, 1, 3])
    expect(s.mediane).toBe(1)
  })

  it('prend la moyenne des deux valeurs centrales sur un effectif pair', () => {
    const s = synthese(
      [
        ligne({ reussis: [] }),
        ligne({ reussis: ['s1-01'] }),
        ligne({ reussis: ['s1-01', 's1-02'] }),
        ligne({ reussis: ['s1-01', 's1-02', 's1-03', 's1-04'] }),
      ],
      comptes,
    )
    expect(s.mediane).toBe(2)
  })

  it('ne divise pas par zéro sur une salle vide', () => {
    const s = synthese([], comptes)
    expect(s.mediane).toBe(0)
    expect(s.avancements).toEqual([])
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

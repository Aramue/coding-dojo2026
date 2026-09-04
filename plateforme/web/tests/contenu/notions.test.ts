import { describe, expect, it } from 'vitest'
import { grouper, grouperParChapitre, premiereOuverte } from '../../src/contenu/notions'
import type { Exercice, Lecon, Notion } from '../../src/contenu/types'

const NOTIONS: Notion[] = [
  { id: 'afficher', ordre: 1, titre: 'Afficher un message', famille: 'conditions', chapitre: 'bases' },
  { id: 'variables', ordre: 2, titre: 'Les variables', famille: 'variables', chapitre: 'bases' },
]

function ex(id: string, notion: string): Exercice {
  return {
    id,
    concept: 'print',
    notion,
    famille: 'conditions',
    seance: 1,
    niveau: 'normal',
    type: 'ecrire',
    titre: id,
    obligatoire: true,
    enonce: '',
    depart: '',
    indices: [],
    tests: [],
  }
}

const LECON: Lecon = {
  id: 'c1-afficher',
  notion: 'afficher',
  ordre: 1,
  titre: 'Afficher un message',
  dureeMin: 3,
  famille: 'conditions',
  blocs: [],
}

describe('grouper', () => {
  it('rend un groupe par notion, dans l ordre declare', () => {
    const groupes = grouper(NOTIONS, [], [], [])
    expect(groupes.map((g) => g.id)).toEqual(['afficher', 'variables'])
  })

  it('trie par ordre, pas par ordre d arrivee', () => {
    const desordre = [NOTIONS[1]!, NOTIONS[0]!]
    expect(grouper(desordre, [], [], []).map((g) => g.id)).toEqual(['afficher', 'variables'])
  })

  it('ne modifie pas le tableau qu on lui donne', () => {
    const donne = [NOTIONS[1]!, NOTIONS[0]!]
    grouper(donne, [], [], [])
    expect(donne.map((n) => n.id)).toEqual(['variables', 'afficher'])
  })

  it('range chaque exercice dans sa notion, dans l ordre du fichier', () => {
    const groupes = grouper(NOTIONS, [ex('s1-09', 'variables'), ex('s1-01', 'afficher')], [], [])
    expect(groupes[0]!.exercices.map((e) => e.id)).toEqual(['s1-01'])
    expect(groupes[1]!.exercices.map((e) => e.id)).toEqual(['s1-09'])
  })

  it('ignore un exercice dont la notion n existe pas', () => {
    const groupes = grouper(NOTIONS, [ex('s1-99', 'algebre')], [], [])
    expect(groupes.flatMap((g) => g.exercices)).toHaveLength(0)
  })

  it('compte les exercices reussis de chaque notion', () => {
    const groupes = grouper(
      NOTIONS,
      [ex('s1-01', 'afficher'), ex('s1-02', 'afficher')],
      [],
      ['s1-01'],
    )
    expect(groupes[0]!.faits).toBe(1)
    expect(groupes[1]!.faits).toBe(0)
  })

  it('ne compte pas un exercice reussi d une autre notion', () => {
    const groupes = grouper(NOTIONS, [ex('s1-01', 'afficher')], [], ['s1-09'])
    expect(groupes[0]!.faits).toBe(0)
  })

  it('rattache la lecon de la notion, ou null', () => {
    const groupes = grouper(NOTIONS, [], [LECON], [])
    expect(groupes[0]!.lecon?.id).toBe('c1-afficher')
    expect(groupes[1]!.lecon).toBeNull()
  })

  it('garde le titre et la famille de la notion', () => {
    const groupes = grouper(NOTIONS, [], [], [])
    expect(groupes[1]).toMatchObject({ titre: 'Les variables', famille: 'variables' })
  })
})

describe('premiereOuverte', () => {
  it('rend la premiere notion dont les exercices ne sont pas tous reussis', () => {
    const groupes = grouper(
      NOTIONS,
      [ex('s1-01', 'afficher'), ex('s1-09', 'variables')],
      [],
      ['s1-01'],
    )
    expect(premiereOuverte(groupes)?.id).toBe('variables')
  })

  it('rend la premiere notion quand tout est reussi', () => {
    const groupes = grouper(NOTIONS, [ex('s1-01', 'afficher')], [], ['s1-01'])
    expect(premiereOuverte(groupes)?.id).toBe('afficher')
  })

  it('rend null sans aucune notion', () => {
    expect(premiereOuverte([])).toBeNull()
  })

  it('considere une notion sans exercice comme terminee', () => {
    // Sinon `/` enverrait l'eleve sur une liste vide des la premiere seance
    // ou une notion n'a pas encore d'exercices.
    const groupes = grouper(NOTIONS, [ex('s1-09', 'variables')], [], [])
    expect(premiereOuverte(groupes)?.id).toBe('variables')
  })
})

describe('grouperParChapitre', () => {
  const CHAPITRES = [
    { id: 'bases', ordre: 1, titre: 'Les bases de Python', seance: 1 },
    { id: 'suite', ordre: 2, titre: 'Aller plus loin', seance: 1 },
  ]

  it('range chaque notion dans son chapitre, dans l ordre declare', () => {
    const groupes = grouper(NOTIONS, [], [], [])
    const chapitres = grouperParChapitre(CHAPITRES, groupes)
    expect(chapitres.map((c) => c.id)).toEqual(['bases', 'suite'])
    expect(chapitres[0]!.notions.map((n) => n.id)).toEqual(['afficher', 'variables'])
    expect(chapitres[1]!.notions).toHaveLength(0)
  })

  it('cumule l avancement des notions du chapitre', () => {
    const groupes = grouper(
      NOTIONS,
      [ex('s1-01', 'afficher'), ex('s1-02', 'afficher'), ex('s1-09', 'variables')],
      [],
      ['s1-01', 's1-09'],
    )
    const [bases] = grouperParChapitre(CHAPITRES, groupes)
    expect(bases!.faits).toBe(2)
    expect(bases!.total).toBe(3)
  })

  it('ignore une notion dont le chapitre n existe pas', () => {
    const orpheline = [{ ...NOTIONS[0]!, chapitre: 'ailleurs' }]
    const chapitres = grouperParChapitre(CHAPITRES, grouper(orpheline, [], [], []))
    expect(chapitres.flatMap((c) => c.notions)).toHaveLength(0)
  })
})

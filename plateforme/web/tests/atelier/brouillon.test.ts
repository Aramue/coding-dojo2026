import { describe, expect, it } from 'vitest'
import {
  BROUILLON_VIDE,
  champsManquants,
  seanceDeLIdentifiant,
  versExercice,
  type Brouillon,
} from '../../src/atelier/brouillon'
import type { Notion } from '../../src/contenu/types'

const NOTIONS: Notion[] = [
  { id: 'comparer', ordre: 7, titre: 'Comparer', famille: 'types', chapitre: 'decisions' },
]

function complet(surcharge: Partial<Brouillon> = {}): Brouillon {
  return {
    ...BROUILLON_VIDE,
    id: 's2-14',
    concept: 'booleens',
    notion: 'comparer',
    seance: 2,
    titre: 'Comparer deux nombres',
    enonce: 'Compare.',
    solution: 'print(1 < 2)',
    tests: [{ type: 'interdit', motif: 'xyzzy' }],
    ...surcharge,
  }
}

describe('seanceDeLIdentifiant', () => {
  it.each([
    ['s1-01', 1],
    ['s4-12', 4],
    ['s99-40', 99],
    ['s12-07-expert', 12],
  ])('lit %s comme la séance %i', (id, seance) => {
    expect(seanceDeLIdentifiant(id)).toBe(seance)
  })

  it.each(['', 's0-01', 's01-01', 's100-01', 's1-1', 'x1-01', 's1'])(
    'ne lit aucune séance dans %j',
    (id) => {
      expect(seanceDeLIdentifiant(id)).toBeNull()
    },
  )
})

describe('champsManquants', () => {
  it('ne réclame rien sur un brouillon complet', () => {
    expect(champsManquants(complet())).toEqual([])
  })

  it('réclame tout sur un brouillon vide, dans l ordre du formulaire', () => {
    // L'ordre compte : c'est celui dans lequel le professeur descend la page.
    expect(champsManquants(BROUILLON_VIDE)).toEqual([
      'un identifiant bien formé',
      'une notion',
      'un concept',
      'un titre',
      'un énoncé',
      'une solution',
      'au moins un test',
    ])
  })

  it.each([
    ['id', { id: 's0-01' }, 'un identifiant bien formé'],
    ['notion', { notion: '' }, 'une notion'],
    ['concept', { concept: '   ' }, 'un concept'],
    ['titre', { titre: '  ' }, 'un titre'],
    ['enonce', { enonce: '\n' }, 'un énoncé'],
    ['solution', { solution: '' }, 'une solution'],
    ['tests', { tests: [] }, 'au moins un test'],
  ])('réclame %s quand il manque', (_, surcharge, attendu) => {
    expect(champsManquants(complet(surcharge))).toEqual([attendu])
  })
})

describe('versExercice', () => {
  it('prend la famille de sa notion, comme le fait la construction', () => {
    expect(versExercice(complet(), NOTIONS).famille).toBe('types')
  })

  it("retombe sur une famille par défaut tant qu'aucune notion n'est choisie", () => {
    // L'aperçu doit rester visible pendant qu'on remplit : sans couleur, pas
    // sans écran.
    expect(versExercice(complet({ notion: '' }), NOTIONS).famille).toBe('variables')
  })

  it('reporte tout le reste tel quel', () => {
    const exercice = versExercice(complet(), NOTIONS)
    expect(exercice.id).toBe('s2-14')
    expect(exercice.tests).toHaveLength(1)
  })
})

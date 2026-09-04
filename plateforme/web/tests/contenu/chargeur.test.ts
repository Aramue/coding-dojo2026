import { describe, expect, it } from 'vitest'
import { nomsVariablesRequis } from '../../src/contenu/chargeur'
import type { Exercice } from '../../src/contenu/types'

const exercice = (tests: Exercice['tests']): Exercice => ({
  id: 's1-10',
  concept: 'variables',
  famille: 'variables',
  seance: 1,
  niveau: 'normal',
  type: 'completer',
  titre: 'Range un prenom',
  obligatoire: true,
  enonce: '',
  depart: '',
  indices: [],
  tests,
})

describe('nomsVariablesRequis', () => {
  it('collecte les noms des tests variable', () => {
    const ex = exercice([
      { type: 'variable', nom: 'nom', typeAttendu: 'str' },
      { type: 'variable', nom: 'age', typeAttendu: 'int' },
      { type: 'sortie', entrees: [], attendu: 'x' },
    ])
    expect(nomsVariablesRequis(ex)).toEqual(['age', 'nom'])
  })

  it('renvoie un tableau vide sans test variable', () => {
    expect(nomsVariablesRequis(exercice([{ type: 'sortie', entrees: [], attendu: 'x' }]))).toEqual([])
  })

  it('dedoublonne', () => {
    const ex = exercice([
      { type: 'variable', nom: 'age', typeAttendu: 'int' },
      { type: 'variable', nom: 'age', valeurAttendue: '17' },
    ])
    expect(nomsVariablesRequis(ex)).toEqual(['age'])
  })
})

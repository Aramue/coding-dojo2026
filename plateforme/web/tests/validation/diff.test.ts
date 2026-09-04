import { describe, expect, it } from 'vitest'
import { diffCaracteres, rendreVisible } from '../../src/validation/diff'

describe('diffCaracteres', () => {
  it('renvoie un seul segment egal quand les textes sont identiques', () => {
    expect(diffCaracteres('abc', 'abc')).toEqual([{ type: 'egal', texte: 'abc' }])
  })

  it('signale un caractere en trop', () => {
    expect(diffCaracteres('abc', 'abxc')).toEqual([
      { type: 'egal', texte: 'ab' },
      { type: 'ajout', texte: 'x' },
      { type: 'egal', texte: 'c' },
    ])
  })

  it('signale un caractere manquant', () => {
    expect(diffCaracteres('abc', 'ac')).toEqual([
      { type: 'egal', texte: 'a' },
      { type: 'manque', texte: 'b' },
      { type: 'egal', texte: 'c' },
    ])
  })

  it('signale une espace en trop, le cas le plus frequent', () => {
    expect(diffCaracteres('Bonjour Camille', 'Bonjour  Camille')).toEqual([
      { type: 'egal', texte: 'Bonjour ' },
      { type: 'ajout', texte: ' ' },
      { type: 'egal', texte: 'Camille' },
    ])
  })

  it('gere une chaine obtenue vide', () => {
    expect(diffCaracteres('abc', '')).toEqual([{ type: 'manque', texte: 'abc' }])
  })
})

describe('rendreVisible', () => {
  it('rend les espaces et les sauts de ligne visibles', () => {
    expect(rendreVisible('a b\nc')).toBe('a·b⏎\nc')
  })
})

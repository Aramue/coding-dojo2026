import { describe, expect, it } from 'vitest'
import { diffCaracteres, diffInformatif, rendreVisible } from '../../src/validation/diff'

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

describe('diffCaracteres — les queues de chaine', () => {
  it("signale les caracteres en trop a la fin", () => {
    // Couvre la boucle de queue cote `obtenu` : sans ce cas, les caracteres
    // ajoutes apres la fin de l'attendu ne seraient jamais rendus.
    expect(diffCaracteres('ab', 'abc')).toEqual([
      { type: 'egal', texte: 'ab' },
      { type: 'ajout', texte: 'c' },
    ])
  })

  it('gere une chaine attendue vide', () => {
    expect(diffCaracteres('', 'abc')).toEqual([{ type: 'ajout', texte: 'abc' }])
  })
})

describe('diffInformatif', () => {
  const diff = (a: string, b: string) => diffCaracteres(a, b)

  it('marque un ecart d un seul caractere', () => {
    expect(diffInformatif(diff('Bonjour Camille', 'Bonjour camille'))).toBe(true)
  })

  it('marque un espace en trop', () => {
    expect(diffInformatif(diff('Bonjour·Camille', 'Bonjour··Camille'))).toBe(true)
  })

  it('marque une fin de phrase manquante, qui est un seul bloc', () => {
    expect(diffInformatif(diff('Bonjour·tout·le·monde', 'Bonjour'))).toBe(true)
  })

  it('renonce quand les deux sorties n ont rien a voir', () => {
    // Le cas qui a motive le changement : la sous-sequence commune de
    // « banane » et « Bonjour tout le monde » n'est qu'un semis de lettres,
    // et le surlignage decoupait les deux lignes en confettis.
    expect(diffInformatif(diff('Bonjour·tout·le·monde', 'banane'))).toBe(false)
  })

  it('renonce quand rien n est commun', () => {
    expect(diffInformatif(diff('196', '42'))).toBe(false)
  })

  it('renonce sur deux sorties vides plutot que de diviser par zero', () => {
    expect(diffInformatif(diff('', ''))).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { normaliser } from '../../src/validation/normaliser'

describe('normaliser', () => {
  it('supprime les espaces en fin de ligne', () => {
    expect(normaliser('Bonjour Camille   \nAge 17')).toBe('bonjour camille\nage 17')
  })

  it('supprime les lignes vides finales', () => {
    expect(normaliser('Bonjour\n\n\n')).toBe('bonjour')
  })

  it('reduit les espaces multiples internes a un seul', () => {
    expect(normaliser('Bonjour    Camille')).toBe('bonjour camille')
  })

  it('ignore la casse', () => {
    expect(normaliser('ACCES AUTORISE')).toBe('acces autorise')
  })

  it('retire les accents', () => {
    expect(normaliser('Accès autorisé')).toBe('acces autorise')
  })

  it('unifie les fleches et les deux-points', () => {
    // Diallo a ete recale en 2025 pour avoir ecrit -> au lieu de →
    expect(normaliser('Position 1 → 8')).toBe(normaliser('Position 1 -> 8'))
    expect(normaliser('Position 1 : 8')).toBe(normaliser('Position 1 -> 8'))
  })

  it('unifie les apostrophes droites et typographiques', () => {
    expect(normaliser("Ton code d'acces")).toBe(normaliser('Ton code d’acces'))
  })

  it('supprime les emoji', () => {
    expect(normaliser('Acces autorise ✅')).toBe('acces autorise')
  })

  it('unifie les fins de ligne Windows', () => {
    expect(normaliser('a\r\nb')).toBe('a\nb')
  })

  it('laisse une sortie deja propre inchangee', () => {
    expect(normaliser('bonjour camille\nage 17')).toBe('bonjour camille\nage 17')
  })
})

import { describe, expect, it } from 'vitest'
import { categorieErreur } from '../../src/execution/exceptions'

describe('categorieErreur', () => {
  it('laisse passer les exceptions du langage', () => {
    expect(categorieErreur('NameError')).toBe('NameError')
    expect(categorieErreur('TypeError')).toBe('TypeError')
    expect(categorieErreur('TimeoutError')).toBe('TimeoutError')
  })

  it('remplace une exception definie par l eleve', () => {
    // Un eleve peut ecrire : class MotDePasseSecret(Exception): pass
    expect(categorieErreur('MotDePasseSecretDeQuentin')).toBe('AutreErreur')
    expect(categorieErreur('CoucouLeProf')).toBe('AutreErreur')
  })

  it('renvoie null quand il n y a pas d erreur', () => {
    expect(categorieErreur(null)).toBeNull()
    expect(categorieErreur(undefined)).toBeNull()
    expect(categorieErreur('')).toBeNull()
  })
})

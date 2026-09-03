import { describe, expect, it } from 'vitest'
import { traduireErreur } from '../../src/validation/erreurs'

describe('traduireErreur', () => {
  it('traduit NameError en nommant la variable', () => {
    const m = traduireErreur({ type: 'NameError', message: "name 'nom' is not defined", ligne: 3 })
    expect(m.titre).toContain('nom')
    expect(m.titre).toMatch(/existe pas/i)
    expect(m.explication).toMatch(/avant de lui avoir donné une valeur/i)
    expect(m.piste).toMatch(/majuscule|différemment/i)
  })

  it('traduit la concatenation texte + nombre', () => {
    const m = traduireErreur({
      type: 'TypeError',
      message: 'can only concatenate str (not "int") to str',
      ligne: 5,
    })
    expect(m.explication).toMatch(/nombre.*texte|texte.*nombre/i)
    expect(m.piste).toContain('str(')
  })

  it('traduit int() sur du texte non numerique', () => {
    const m = traduireErreur({
      type: 'ValueError',
      message: "invalid literal for int() with base 10: 'vingt'",
      ligne: 2,
    })
    expect(m.explication).toMatch(/chiffres/i)
    expect(m.titre).toContain('vingt')
  })

  it('traduit le deux-points manquant', () => {
    const m = traduireErreur({ type: 'SyntaxError', message: 'expected \':\'', ligne: 4 })
    expect(m.piste).toContain(':')
  })

  it('traduit IndentationError', () => {
    const m = traduireErreur({
      type: 'IndentationError',
      message: 'expected an indented block',
      ligne: 6,
    })
    expect(m.explication).toMatch(/décalé/i)
  })

  it('traduit la division par zero', () => {
    const m = traduireErreur({
      type: 'ZeroDivisionError',
      message: 'division by zero',
      ligne: 1,
    })
    expect(m.explication).toMatch(/zéro/i)
  })

  it('ne donne jamais la ligne de code corrigee', () => {
    const m = traduireErreur({ type: 'NameError', message: "name 'age' is not defined", ligne: 1 })
    expect(m.piste).not.toMatch(/age\s*=\s*\d/)
  })

  it('retombe sur un message generique pour une exception inconnue', () => {
    const m = traduireErreur({ type: 'RecursionError', message: 'boom', ligne: null })
    expect(m.titre).toBeTruthy()
    expect(m.explication).toBeTruthy()
    expect(m.piste).toBeTruthy()
  })
})

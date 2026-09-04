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
    // Le f-string n'est enseigné qu'en s1-23, alors que ce TypeError se
    // rencontre en s1-21 — dont le test exige justement str(). Conseiller une
    // technique pas encore vue, et que l'exercice refuse, envoie l'élève au mur.
    expect(m.piste).not.toMatch(/f-string/i)
  })

  it('traduit int() sur du texte non numerique', () => {
    const m = traduireErreur({
      type: 'ValueError',
      message: "invalid literal for int() with base 10: 'vingt'",
      ligne: 2,
    })
    expect(m.explication).toMatch(/chiffres/i)
    expect(m.titre).toContain('vingt')
    // Le message est lu PAR l'eleve : il s'adresse a lui, pas au professeur.
    expect(m.piste).not.toMatch(/l'élève|l'eleve/i)
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

describe('traduireErreur — les regles qui n etaient pas couvertes', () => {
  const erreur = (type: string, message: string) => ({ type, message, ligne: 1 })

  it("nomme l'operation et les deux types sur un operande non supporte", () => {
    const m = traduireErreur(
      erreur('TypeError', "unsupported operand type(s) for +: 'int' and 'str'"),
    )
    expect(m.titre).toContain('+')
    expect(m.titre).toContain('int')
    expect(m.titre).toContain('str')
    expect(m.piste).toMatch(/input\(\)/)
  })

  it('reconnait les deux formulations du guillemet non ferme', () => {
    // Python 3.10+ dit « unterminated string literal », les versions
    // anterieures « EOL while scanning ». Les deux doivent tomber sur le
    // meme message.
    for (const message of [
      'unterminated string literal (detected at line 1)',
      'EOL while scanning string literal',
    ]) {
      expect(traduireErreur(erreur('SyntaxError', message)).titre).toMatch(/guillemet/i)
    }
  })

  it('rappelle que la premiere position est 0 sur un IndexError', () => {
    const m = traduireErreur(erreur('IndexError', 'string index out of range'))
    expect(m.explication).toContain('0')
    expect(m.piste).toContain('len(')
  })

  it("nomme le type et l'attribut sur un AttributeError", () => {
    const m = traduireErreur(erreur('AttributeError', "'int' object has no attribute 'upper'"))
    expect(m.titre).toContain('int')
    expect(m.titre).toContain('upper')
  })

  it('traite le depassement de temps a part, avant toute regle', () => {
    const m = traduireErreur(erreur('TimeoutError', ''))
    expect(m.titre).toMatch(/tourne en rond/i)
    expect(m.piste).toContain('while')
  })

  it('retombe sur le generique quand le type est connu mais le message inattendu', () => {
    // Une regle n'est retenue que si son motif accroche : un TypeError d'une
    // autre forme ne doit pas emprunter le message d'une regle voisine.
    const m = traduireErreur(erreur('TypeError', "'int' object is not callable"))
    expect(m.titre).toMatch(/arrêté sur une erreur/i)
  })

  it("ne laisse jamais fuir de jargon anglais vers l'eleve", () => {
    const cas = [
      erreur('NameError', "name 'x' is not defined"),
      erreur('TypeError', 'can only concatenate str (not "int") to str'),
      erreur('ZeroDivisionError', 'division by zero'),
      erreur('IndexError', 'string index out of range'),
      erreur('AttributeError', "'int' object has no attribute 'upper'"),
      erreur('TimeoutError', ''),
      erreur('RecursionError', 'boom'),
    ]
    for (const e of cas) {
      const m = traduireErreur(e)
      expect(`${m.titre} ${m.explication}`).not.toMatch(
        /is not defined|unsupported|invalid literal|out of range|division by zero|no attribute/,
      )
    }
  })
})

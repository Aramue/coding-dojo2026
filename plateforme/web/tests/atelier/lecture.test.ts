import { describe, expect, it } from 'vitest'
import {
  FichierRefuse,
  lireExercice,
  lireLecon,
  porteDesCommentaires,
} from '../../src/atelier/lecture'

const COMPLET = `id: s2-14
concept: booleens
notion: comparer
seance: 2
niveau: normal
type: debug
titre: Comparer
obligatoire: true
enonce: |
  Compare.
depart: |
  a = 1
indices:
  - Un indice.
tests:
  - type: sortie
    entrees: ["4321"]
    attendu: |-
      Vrai
solution: |
  b = 2
`

function refus(texte: string): string[] {
  try {
    lireExercice(texte)
  } catch (erreur) {
    if (erreur instanceof FichierRefuse) return erreur.raisons
    throw erreur
  }
  throw new Error('le fichier aurait dû être refusé')
}

describe('lireExercice — un fichier bien formé', () => {
  it('rend un brouillon complet', () => {
    const b = lireExercice(COMPLET)
    expect(b.id).toBe('s2-14')
    expect(b.seance).toBe(2)
    expect(b.obligatoire).toBe(true)
    expect(b.indices).toEqual(['Un indice.'])
    expect(b.tests).toEqual([{ type: 'sortie', entrees: ['4321'], attendu: 'Vrai' }])
    expect(b.solution).toBe('b = 2\n')
  })

  it('remet les champs facultatifs dans leur forme du navigateur', () => {
    const b = lireExercice(
      COMPLET.replace('solution: |', 'expert: s2-14-expert\nsolution: |').replace(
        '    attendu: |-\n      Vrai\n',
        '    attendu: |-\n      Vrai\n    exige_exact: true\n',
      ),
    )
    expect(b.expert).toBe('s2-14-expert')
    expect(b.tests[0]).toMatchObject({ exigeExact: true })
  })

  it('traduit les noms de champs des tests en camelCase', () => {
    const b = lireExercice(
      COMPLET.replace(
        /  - type: sortie\n    entrees: \["4321"\]\n    attendu: \|-\n      Vrai\n/,
        '  - type: variable\n    nom: age\n    valeur_attendue: "17"\n    type_attendu: int\n',
      ),
    )
    expect(b.tests[0]).toEqual({ type: 'variable', nom: 'age', valeurAttendue: '17', typeAttendu: 'int' })
  })

  it('lit un QCM et sa bonne réponse', () => {
    const b = lireExercice(
      COMPLET.replace(
        /  - type: sortie\n    entrees: \["4321"\]\n    attendu: \|-\n      Vrai\n/,
        '  - type: qcm\n    options:\n      - "5"\n      - "23"\n    bonne_reponse: 1\n',
      ),
    )
    expect(b.tests[0]).toEqual({ type: 'qcm', options: ['5', '23'], bonneReponse: 1 })
  })

  it('lit un contient avec sa maîtrise et son message', () => {
    const b = lireExercice(
      COMPLET.replace(
        /  - type: sortie\n    entrees: \["4321"\]\n    attendu: \|-\n      Vrai\n/,
        '  - type: contient\n    motif: for\n    message: Emploie une boucle.\n    maitrise: true\n',
      ),
    )
    expect(b.tests[0]).toEqual({
      type: 'contient',
      motif: 'for',
      message: 'Emploie une boucle.',
      maitrise: true,
    })
  })

  it('accepte un départ et des indices absents', () => {
    const sans = COMPLET.replace('depart: |\n  a = 1\n', '').replace('indices:\n  - Un indice.\n', '')
    const b = lireExercice(sans)
    expect(b.depart).toBe('')
    expect(b.indices).toEqual([])
  })
})

describe('lireExercice — ce qu il refuse, et ce qu il en dit', () => {
  it('nomme la ligne fautive d un YAML cassé', () => {
    expect(refus('id: s2-14\ntitre: "pas fermé\n')[0]).toMatch(/YAML valide \(ligne \d+\)/)
  })

  it("refuse un document qui n'est pas un exercice", () => {
    expect(refus('- un\n- deux\n')[0]).toMatch(/ne décrit pas un exercice/)
    expect(refus('juste du texte\n')[0]).toMatch(/ne décrit pas un exercice/)
  })

  it('refuse un champ inconnu plutôt que de le perdre à l export', () => {
    // Le charger en l'ignorant le perdrait au premier export, sans un mot.
    const raisons = refus(COMPLET.replace('titre: Comparer', 'titre: Comparer\nsurnom: Cam'))
    expect(raisons[0]).toMatch(/champ inconnu : surnom/)
    expect(raisons[0]).toMatch(/perdrait à l'export/)
  })

  it('nomme tous les champs requis qui manquent', () => {
    const raisons = refus('id: s2-14\nnotion: comparer\n')
    expect(raisons[0]).toMatch(/concept/)
    expect(raisons[0]).toMatch(/solution/)
  })

  it('refuse un test dont le type est inconnu', () => {
    const raisons = refus(COMPLET.replace('  - type: sortie', '  - type: devinette'))
    expect(raisons[0]).toMatch(/type inconnu : « devinette »/)
  })

  it('refuse un champ inconnu dans un test, en le situant', () => {
    const raisons = refus(COMPLET.replace('    entrees: ["4321"]', '    entrees: []\n    poids: 3'))
    expect(raisons[0]).toMatch(/le test 1 porte un champ inconnu : poids/)
  })
})

describe('porteDesCommentaires', () => {
  it("n'en voit pas là où il n'y en a pas", () => {
    expect(porteDesCommentaires(COMPLET)).toBe(false)
  })

  it('en voit un posé au-dessus d une clé', () => {
    expect(porteDesCommentaires('# En tête\n' + COMPLET)).toBe(true)
    expect(porteDesCommentaires(COMPLET.replace('tests:', '# Pourquoi ceci\ntests:'))).toBe(true)
  })

  it('en voit un en bout de ligne', () => {
    expect(porteDesCommentaires(COMPLET.replace('seance: 2', 'seance: 2 # la deuxième'))).toBe(true)
  })

  it("ne prend pas un croisillon dans du texte pour un commentaire", () => {
    // « #1 du classement » dans un titre n'est pas un commentaire.
    expect(porteDesCommentaires(COMPLET.replace('titre: Comparer', 'titre: "#1 du classement"'))).toBe(
      false,
    )
  })
})

describe('lireExercice — des tests réduits au minimum', () => {
  function avecTest(bloc: string) {
    return lireExercice(
      COMPLET.replace(
        /  - type: sortie\n    entrees: \["4321"\]\n    attendu: \|-\n      Vrai\n/,
        bloc,
      ),
    ).tests[0]
  }

  it("refuse un test sans type plutôt que d'en deviner un", () => {
    const sansType = COMPLET.replace(
      '  - type: sortie\n    entrees: ["4321"]\n    attendu: |-\n      Vrai\n',
      '  - entrees: []\n',
    )
    expect(refus(sansType)[0]).toMatch(/type inconnu/)
  })

  it('donne leurs valeurs par défaut aux champs absents', () => {
    // Un fichier écrit à la main peut omettre `entrees` ou `options` : on les
    // remplit plutôt que de laisser passer `undefined` dans le formulaire.
    expect(avecTest('  - type: sortie\n')).toEqual({ type: 'sortie', entrees: [], attendu: '' })
    expect(avecTest('  - type: variable\n')).toEqual({ type: 'variable', nom: '' })
    expect(avecTest('  - type: qcm\n')).toEqual({ type: 'qcm', options: [], bonneReponse: 0 })
    expect(avecTest('  - type: interdit\n')).toEqual({ type: 'interdit', motif: '' })
  })

  it('lit une valeur attendue sans type attendu', () => {
    expect(avecTest('  - type: variable\n    nom: age\n    valeur_attendue: "17"\n')).toEqual({
      type: 'variable',
      nom: 'age',
      valeurAttendue: '17',
    })
  })

  it('lit un type attendu sans valeur attendue', () => {
    expect(avecTest('  - type: variable\n    nom: age\n    type_attendu: int\n')).toEqual({
      type: 'variable',
      nom: 'age',
      typeAttendu: 'int',
    })
  })
})

describe('porteDesCommentaires — au niveau du document', () => {
  it('en voit un posé après tout le contenu', () => {
    expect(porteDesCommentaires(COMPLET + '# une remarque finale\n')).toBe(true)
  })
})

const LECON = `id: c2-comparer
notion: comparer
ordre: 7
titre: Comparer
duree_min: 4
blocs:
  - type: paragraphe
    texte: >-
      Une comparaison pose une question.
  - type: code
    legende: Deux questions
    executable: true
    python: |
      print(12 > 7)
`

function refusLecon(texte: string): string[] {
  try {
    lireLecon(texte)
  } catch (erreur) {
    if (erreur instanceof FichierRefuse) return erreur.raisons
    throw erreur
  }
  throw new Error('le fichier aurait dû être refusé')
}

describe('lireLecon — une leçon bien formée', () => {
  it('rend un brouillon complet', () => {
    const l = lireLecon(LECON)
    expect(l.id).toBe('c2-comparer')
    expect(l.dureeMin).toBe(4)
    expect(l.blocs).toEqual([
      { type: 'paragraphe', texte: 'Une comparaison pose une question.' },
      {
        type: 'code',
        legende: 'Deux questions',
        python: 'print(12 > 7)\n',
        executable: true,
        entrees: [],
      },
    ])
  })

  it("n'invente pas un exécutable là où il n'est pas déclaré", () => {
    const l = lireLecon(LECON.replace('    executable: true\n', ''))
    expect(l.blocs[1]).toMatchObject({ executable: false })
  })

  it('lit les entrées simulées d un bloc', () => {
    const l = lireLecon(LECON.replace('    executable: true', '    entrees: ["Camille"]'))
    expect(l.blocs[1]).toMatchObject({ entrees: ['Camille'] })
  })

  it('donne leurs valeurs par défaut aux champs absents d un bloc', () => {
    const l = lireLecon(
      LECON.replace(
        /  - type: code\n    legende: Deux questions\n    executable: true\n    python: \|\n      print\(12 > 7\)\n/,
        '  - type: code\n',
      ),
    )
    expect(l.blocs[1]).toEqual({
      type: 'code',
      legende: '',
      python: '',
      executable: false,
      entrees: [],
    })
  })

  it('lit un bloc attention', () => {
    const l = lireLecon(LECON.replace('  - type: paragraphe', '  - type: attention'))
    expect(l.blocs[0]).toEqual({ type: 'attention', texte: 'Une comparaison pose une question.' })
  })

  it('accepte un bloc de texte vide', () => {
    const l = lireLecon(
      LECON.replace('    texte: >-\n      Une comparaison pose une question.\n', ''),
    )
    expect(l.blocs[0]).toEqual({ type: 'paragraphe', texte: '' })
  })
})

describe('lireLecon — ce qu il refuse', () => {
  it('nomme la ligne fautive d un YAML cassé', () => {
    expect(refusLecon('id: c2\ntitre: "pas fermé\n')[0]).toMatch(/YAML valide \(ligne \d+\)/)
  })

  it("refuse un document qui n'est pas une leçon", () => {
    expect(refusLecon('- un\n- deux\n')[0]).toMatch(/ne décrit pas une leçon/)
  })

  it('refuse un champ inconnu plutôt que de le perdre à l export', () => {
    expect(refusLecon(LECON.replace('titre: Comparer', 'titre: Comparer\nsurnom: Cam'))[0]).toMatch(
      /champ inconnu : surnom/,
    )
  })

  it('nomme les champs requis qui manquent', () => {
    const raisons = refusLecon('id: c2-comparer\nnotion: comparer\n')
    expect(raisons[0]).toMatch(/ordre/)
    expect(raisons[0]).toMatch(/blocs/)
  })

  it('refuse un bloc dont le type est inconnu', () => {
    expect(refusLecon(LECON.replace('  - type: paragraphe', '  - type: encadre'))[0]).toMatch(
      /le bloc 1 a un type inconnu : « encadre »/,
    )
  })

  it("refuse un bloc sans type plutôt que d'en deviner un", () => {
    const sansType = LECON.replace(
      '  - type: paragraphe\n    texte: >-\n      Une comparaison pose une question.\n',
      '  - texte: Sans type.\n',
    )
    expect(refusLecon(sansType)[0]).toMatch(/le bloc 1 a un type inconnu/)
  })

  it('refuse un champ inconnu dans un bloc, en le situant', () => {
    const raisons = refusLecon(LECON.replace('    legende: Deux questions', '    couleur: bleu'))
    expect(raisons[0]).toMatch(/le bloc 2 porte un champ inconnu : couleur/)
  })
})

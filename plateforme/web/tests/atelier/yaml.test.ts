import { describe, expect, it } from 'vitest'
import { BROUILLON_VIDE, type Brouillon } from '../../src/atelier/brouillon'
import { enYaml, nomDeFichier } from '../../src/atelier/yaml'

function exemple(surcharge: Partial<Brouillon> = {}): Brouillon {
  return {
    ...BROUILLON_VIDE,
    id: 's2-14',
    concept: 'booleens',
    notion: 'comparer',
    seance: 2,
    niveau: 'normal',
    type: 'debug',
    titre: '= range, == compare',
    obligatoire: true,
    enonce: "Ce programme demande le code d'un casier.\n",
    depart: 'ouvert = (code = 4321)\n',
    indices: ['Le message parle de la ligne 2.'],
    tests: [{ type: 'sortie', entrees: ['4321'], attendu: 'Casier ouvert : True' }],
    solution: 'ouvert = (code == 4321)\n',
    ...surcharge,
  }
}

describe("enYaml — le style de la maison", () => {
  it('écrit un exercice complet, caractère par caractère', () => {
    expect(enYaml(exemple())).toBe(`id: s2-14
concept: booleens
notion: comparer
seance: 2
niveau: normal
type: debug
titre: "= range, == compare"
obligatoire: true
enonce: |
  Ce programme demande le code d'un casier.
depart: |
  ouvert = (code = 4321)
indices:
  - Le message parle de la ligne 2.
tests:
  - type: sortie
    entrees: ["4321"]
    attendu: |-
      Casier ouvert : True
solution: |
  ouvert = (code == 4321)
`)
  })

  it('garde les clés dans l ordre du modèle, jamais dans l ordre alphabétique', () => {
    const cles = enYaml(exemple())
      .split('\n')
      .filter((l) => /^[a-z_]+:/.test(l))
      .map((l) => l.split(':')[0])
    expect(cles).toEqual([
      'id',
      'concept',
      'notion',
      'seance',
      'niveau',
      'type',
      'titre',
      'obligatoire',
      'enonce',
      'depart',
      'indices',
      'tests',
      'solution',
    ])
  })
})

describe('enYaml — quand un titre a besoin de guillemets', () => {
  it("n'en met pas sur un titre ordinaire", () => {
    expect(enYaml(exemple({ titre: 'Ranger un prénom' }))).toContain('titre: Ranger un prénom\n')
  })

  it.each([
    ['= range, == compare', 'un signe égal en tête'],
    ['Age : la question', 'un deux-points suivi d une espace'],
    ['12 questions', 'un chiffre en tête'],
    ['- une liste', 'un tiret en tête'],
    ['#1 du classement', 'un croisillon en tête'],
    ['Oui', 'un mot que YAML lirait comme un booléen'],
  ])('en met sur %j, à cause d %s', (titre) => {
    expect(enYaml(exemple({ titre }))).toContain(`titre: "${titre}"\n`)
  })

  it("laisse un guillemet nu quand rien n'oblige à entourer", () => {
    // `- print("Bonjour")` dans le dépôt : entourer produirait une forêt
    // d'échappements pour rien.
    expect(enYaml(exemple({ titre: 'Le "vrai" faux' }))).toContain('titre: Le "vrai" faux\n')
  })

  it("entoure d'apostrophes quand il faut entourer ET qu'il y a un guillemet", () => {
    // Une option de QCM comme `'"Bonjour"'` : le dépôt fait exactement ça.
    expect(enYaml(exemple({ titre: '"Bonjour"' }))).toContain(`titre: '"Bonjour"'\n`)
  })
})

describe('enYaml — les textes narratifs et le code', () => {
  it("écrit l'énoncé, le départ et la solution en bloc, toujours", () => {
    // Les 112 fichiers du dépôt le font sans une seule exception : une chaîne
    // sur une ligne rompt l'alignement de la relecture.
    const y = enYaml(exemple({ enonce: 'Une ligne.', depart: 'a = 1', solution: 'b = 2' }))
    expect(y).toContain('enonce: |\n  Une ligne.\n')
    expect(y).toContain('depart: |\n  a = 1\n')
    expect(y).toContain('solution: |\n  b = 2\n')
  })

  it("ne double pas le saut de ligne d'un texte qui en a déjà un", () => {
    const y = enYaml(exemple({ enonce: 'Une ligne.\n' }))
    expect(y).toContain('enonce: |\n  Une ligne.\n')
  })
})

describe('enYaml — les textes longs', () => {
  it('écrit un texte multiligne en bloc, indenté de deux espaces', () => {
    const y = enYaml(exemple({ enonce: 'Première ligne.\nSeconde ligne.\n' }))
    expect(y).toContain('enonce: |\n  Première ligne.\n  Seconde ligne.\n')
  })

  it("écrit un attendu sans saut final en bloc coupé", () => {
    // `|-` et non `|` : le saut de ligne final ferait échouer la comparaison.
    const y = enYaml(exemple({ tests: [{ type: 'sortie', entrees: [], attendu: 'Bonjour' }] }))
    expect(y).toContain('    attendu: |-\n      Bonjour\n')
  })

  it('garde le saut final d un attendu qui en a un', () => {
    const y = enYaml(exemple({ tests: [{ type: 'sortie', entrees: [], attendu: 'Bonjour\n' }] }))
    expect(y).toContain('    attendu: |\n      Bonjour\n')
  })

  it('préserve une ligne vide au milieu d un énoncé', () => {
    const y = enYaml(exemple({ enonce: 'Avant.\n\nAprès.\n' }))
    expect(y).toContain('enonce: |\n  Avant.\n\n  Après.\n')
  })
})

describe('enYaml — ce qui ne sort pas', () => {
  it("écrit un départ vide plutôt que de l'omettre", () => {
    // Les 112 fichiers du dépôt portent tous un `depart`. Son absence se
    // lirait comme un oubli, pas comme un exercice à écrire de zéro.
    expect(enYaml(exemple({ depart: '' }))).toContain(`depart: ''\n`)
  })

  it('omet une liste d indices vide', () => {
    expect(enYaml(exemple({ indices: [] }))).not.toContain('indices')
  })

  it('omet un expert absent, et le porte quand il existe', () => {
    expect(enYaml(exemple())).not.toContain('expert')
    expect(enYaml(exemple({ expert: 's2-14-expert' }))).toContain('expert: s2-14-expert\n')
  })

  it("n'écrit jamais `famille` : elle se déduit de la notion à la construction", () => {
    expect(enYaml(exemple())).not.toContain('famille')
  })
})

describe('enYaml — les cinq sortes de tests', () => {
  it('écrit les entrées en liste courte, sur une ligne', () => {
    const y = enYaml(
      exemple({ tests: [{ type: 'sortie', entrees: ['Camille', '17'], attendu: 'ok' }] }),
    )
    expect(y).toContain('    entrees: ["Camille", "17"]\n')
  })

  it('écrit des entrées vides en liste vide', () => {
    const y = enYaml(exemple({ tests: [{ type: 'sortie', entrees: [], attendu: 'ok' }] }))
    expect(y).toContain('    entrees: []\n')
  })

  it('porte exigeExact en snake_case', () => {
    const y = enYaml(
      exemple({ tests: [{ type: 'sortie', entrees: [], attendu: 'ok', exigeExact: true }] }),
    )
    expect(y).toContain('    exige_exact: true\n')
  })

  it('écrit un test de variable avec ses deux champs facultatifs', () => {
    const y = enYaml(
      exemple({
        tests: [{ type: 'variable', nom: 'age', valeurAttendue: '17', typeAttendu: 'int' }],
      }),
    )
    expect(y).toContain('  - type: variable\n    nom: age\n')
    expect(y).toContain('    valeur_attendue: "17"\n')
    expect(y).toContain('    type_attendu: int\n')
  })

  it('omet les champs facultatifs d un test de variable', () => {
    const y = enYaml(exemple({ tests: [{ type: 'variable', nom: 'age' }] }))
    expect(y).toContain('  - type: variable\n    nom: age\n')
    expect(y).not.toContain('valeur_attendue')
    expect(y).not.toContain('type_attendu')
  })

  it('écrit un QCM avec ses options et sa bonne réponse', () => {
    const y = enYaml(
      exemple({
        type: 'predire',
        tests: [{ type: 'qcm', options: ['5', '23'], bonneReponse: 0 }],
      }),
    )
    expect(y).toContain('  - type: qcm\n    options:\n      - "5"\n      - "23"\n')
    expect(y).toContain('    bonne_reponse: 0\n')
  })

  it('écrit un motif interdit, avec son message quand il en a un', () => {
    const y = enYaml(
      exemple({ tests: [{ type: 'interdit', motif: 'Camille', message: 'Calcule-le.' }] }),
    )
    expect(y).toContain('  - type: interdit\n    motif: Camille\n    message: Calcule-le.\n')
  })

  it('porte la maîtrise sur un contient', () => {
    const y = enYaml(exemple({ tests: [{ type: 'contient', motif: 'for', maitrise: true }] }))
    expect(y).toContain('  - type: contient\n    motif: for\n    maitrise: true\n')
  })

  it("n'écrit pas maitrise quand elle est fausse", () => {
    const y = enYaml(exemple({ tests: [{ type: 'contient', motif: 'for', maitrise: false }] }))
    expect(y).not.toContain('maitrise')
  })
})

describe('nomDeFichier', () => {
  it("prend l'identifiant, et rien d'autre", () => {
    expect(nomDeFichier(exemple())).toBe('s2-14.yaml')
    expect(nomDeFichier(exemple({ id: 's12-07-expert' }))).toBe('s12-07-expert.yaml')
  })
})

describe('enYaml — un champ vide qui doit quand même sortir', () => {
  it('écrit un concept vide entre guillemets plutôt que rien', () => {
    // `concept:` tout court se relirait comme `null`, et le schéma refuserait
    // le fichier sur un message qui ne parle pas du concept.
    expect(enYaml(exemple({ concept: '' }))).toContain('concept: ""\n')
  })
})

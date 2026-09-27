import { describe, expect, it, vi } from 'vitest'
import { BROUILLON_VIDE, type Brouillon } from '../../src/atelier/brouillon'
import { eprouver, remplirAttendu, type Essai } from '../../src/atelier/controles'
import type { Executeur } from '../../src/execution/executeur'
import type { ResultatExecution } from '../../src/execution/types'
import type { Notion } from '../../src/contenu/types'

const NOTIONS: Notion[] = [
  { id: 'comparer', ordre: 7, titre: 'Comparer', famille: 'types', chapitre: 'decisions' },
]

/** Un exécuteur qui rend une sortie par code exécuté. */
function executeurFactice(parCode: Record<string, Partial<ResultatExecution>>): Executeur {
  return {
    executer: async ({ code }: { code: string }): Promise<ResultatExecution> => ({
      stdout: '',
      erreur: null,
      variables: {},
      dureeMs: 3,
      timeout: false,
      ...(parCode[code.trim()] ?? {}),
    }),
    detruire: vi.fn(),
  } as unknown as Executeur
}

function brouillon(surcharge: Partial<Brouillon> = {}): Brouillon {
  return {
    ...BROUILLON_VIDE,
    id: 's2-14',
    concept: 'booleens',
    notion: 'comparer',
    seance: 2,
    titre: 'Comparer',
    enonce: 'Compare.',
    solution: 'print("Vrai")',
    tests: [{ type: 'sortie', entrees: [], attendu: 'Vrai' }],
    ...surcharge,
  }
}

const essai = (essais: Essai[], morceau: string) =>
  essais.find((e) => e.titre.toLowerCase().includes(morceau))

describe('eprouver — la solution de référence', () => {
  it('passe quand elle satisfait ses propres tests', async () => {
    const essais = await eprouver(
      brouillon(),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Vrai' } }),
    )
    expect(essai(essais, 'solution')?.verdict).toBe('vert')
  })

  it('échoue quand elle ne les satisfait pas, et dit ce qui cloche', async () => {
    const essais = await eprouver(
      brouillon(),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Faux' } }),
    )
    const trouve = essai(essais, 'solution')
    expect(trouve?.verdict).toBe('rouge')
    expect(trouve?.detail).toBeTruthy()
  })

  it('exige les critères de maîtrise, eux', async () => {
    // De la solution on exige TOUT : une solution qui n'emploie pas la méthode
    // que l'exercice récompense ne sert de modèle à personne.
    const essais = await eprouver(
      brouillon({
        tests: [
          { type: 'sortie', entrees: [], attendu: 'Vrai' },
          { type: 'contient', motif: 'for', maitrise: true },
        ],
      }),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Vrai' } }),
    )
    expect(essai(essais, 'solution')?.verdict).toBe('rouge')
  })

  it('signale une solution qui plante', async () => {
    const essais = await eprouver(
      brouillon(),
      NOTIONS,
      executeurFactice({
        'print("Vrai")': { erreur: { type: 'NameError', message: 'x', ligne: 1 } },
      }),
    )
    expect(essai(essais, 'solution')?.verdict).toBe('rouge')
  })
})

describe('eprouver — le code de départ', () => {
  it('passe quand le départ échoue, ce qui est ce qu on veut', async () => {
    const essais = await eprouver(
      brouillon({ depart: 'print("Faux")' }),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Vrai' }, 'print("Faux")': { stdout: 'Faux' } }),
    )
    expect(essai(essais, 'départ')?.verdict).toBe('vert')
  })

  it('échoue quand le départ résout déjà l exercice', async () => {
    const essais = await eprouver(
      brouillon({ depart: 'print("Vrai")' }),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Vrai' } }),
    )
    const trouve = essai(essais, 'départ')
    expect(trouve?.verdict).toBe('rouge')
    expect(trouve?.detail).toMatch(/déjà résolu/)
  })

  it("n'exige pas la maîtrise du départ", async () => {
    // Un critère de maîtrise manquant ne bloque pas l'élève : le compter ici
    // masquerait un départ qui résout déjà l'exercice.
    const essais = await eprouver(
      brouillon({
        depart: 'print("Vrai")',
        tests: [
          { type: 'sortie', entrees: [], attendu: 'Vrai' },
          { type: 'contient', motif: 'for', maitrise: true },
        ],
      }),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Vrai' } }),
    )
    expect(essai(essais, 'départ')?.verdict).toBe('rouge')
  })

  it("n'éprouve pas un départ vide : il n'y a rien à éprouver", async () => {
    const essais = await eprouver(
      brouillon({ depart: '' }),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Vrai' } }),
    )
    expect(essai(essais, 'départ')).toBeUndefined()
  })
})

describe('eprouver — les motifs interdits', () => {
  it('refuse un motif que la solution contient elle-même', async () => {
    const essais = await eprouver(
      brouillon({ tests: [{ type: 'interdit', motif: 'Vrai' }] }),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Vrai' } }),
    )
    const trouve = essai(essais, 'motif')
    expect(trouve?.verdict).toBe('rouge')
    expect(trouve?.detail).toMatch(/Vrai/)
  })

  it('refuse un motif qui contient un guillemet', async () => {
    // Il ne bloque que cette ponctuation-là : l'élève écrit la même réponse
    // avec des guillemets simples et passe au vert sans rien résoudre.
    const essais = await eprouver(
      brouillon({ tests: [{ type: 'interdit', motif: '"Camille"' }] }),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': { stdout: 'Vrai' } }),
    )
    expect(essai(essais, 'ponctuation')?.verdict).toBe('rouge')
  })

  it('laisse passer un motif nu absent de la solution', async () => {
    const essais = await eprouver(
      brouillon({ tests: [{ type: 'interdit', motif: 'xyzzy' }] }),
      NOTIONS,
      executeurFactice({ 'print("Vrai")': {} }),
    )
    expect(essais.every((e) => e.verdict === 'vert')).toBe(true)
  })
})

describe('eprouver — un exercice à prédire', () => {
  it("montre ce que produit la solution, pour vérifier la bonne réponse", async () => {
    // verifier_coherence n'exécute rien sur un `predire` : la bonne réponse du
    // QCM n'est vérifiée par aucun outil, elle l'a été à la main.
    const essais = await eprouver(
      brouillon({
        type: 'predire',
        tests: [{ type: 'qcm', options: ['5', '23'], bonneReponse: 0 }],
        solution: 'print(2 + 3)',
      }),
      NOTIONS,
      executeurFactice({ 'print(2 + 3)': { stdout: '5\n' } }),
    )
    const trouve = essai(essais, 'produit')
    expect(trouve?.verdict).toBe('vert')
    expect(trouve?.detail).toContain('5')
  })

  it('signale une solution de prédiction qui plante', async () => {
    const essais = await eprouver(
      brouillon({
        type: 'predire',
        tests: [{ type: 'qcm', options: ['5'], bonneReponse: 0 }],
        solution: 'print(2 + )',
      }),
      NOTIONS,
      executeurFactice({
        'print(2 + )': { erreur: { type: 'SyntaxError', message: 'x', ligne: 1 } },
      }),
    )
    expect(essai(essais, 'produit')?.verdict).toBe('rouge')
  })
})

describe('remplirAttendu', () => {
  it('rend la sortie de la solution pour les entrées du test visé', async () => {
    const attendu = await remplirAttendu(
      brouillon({
        solution: 'print(input())',
        tests: [
          { type: 'sortie', entrees: ['Camille'], attendu: '' },
          { type: 'sortie', entrees: ['Enzo'], attendu: '' },
        ],
      }),
      1,
      {
        executer: async ({ entrees }: { entrees: string[] }) => ({
          stdout: `${entrees[0]}\n`,
          erreur: null,
          variables: {},
          dureeMs: 1,
          timeout: false,
        }),
        detruire: vi.fn(),
      } as unknown as Executeur,
    )
    expect(attendu).toBe('Enzo\n')
  })

  it("lève plutôt que d'écrire un message d'erreur dans l'attendu", async () => {
    // Un attendu rempli avec une trace de plantage serait pire que vide : il
    // aurait l'air d'un attendu.
    await expect(
      remplirAttendu(
        brouillon(),
        0,
        executeurFactice({
          'print("Vrai")': { erreur: { type: 'NameError', message: 'x', ligne: 1 } },
        }),
      ),
    ).rejects.toThrow(/NameError/)
  })

  it('lève quand le programme tourne en rond', async () => {
    await expect(
      remplirAttendu(brouillon(), 0, executeurFactice({ 'print("Vrai")': { timeout: true } })),
    ).rejects.toThrow(/rond/)
  })

  it("lève quand le test visé n'est pas un test de sortie", async () => {
    await expect(
      remplirAttendu(
        brouillon({ tests: [{ type: 'interdit', motif: 'x' }] }),
        0,
        executeurFactice({}),
      ),
    ).rejects.toThrow(/sortie/)
  })
})

describe('eprouver — ce qui décide des exécutions', () => {
  it("lance une exécution sans entrée pour un test de variable", async () => {
    const executeur = {
      executer: vi.fn(async () => ({
        stdout: '',
        erreur: null,
        variables: { age: { valeur: '17', type: 'int' } },
        dureeMs: 1,
        timeout: false,
      })),
      detruire: vi.fn(),
    } as unknown as Executeur

    const essais = await eprouver(
      brouillon({
        solution: 'age = 17',
        tests: [{ type: 'variable', nom: 'age', valeurAttendue: '17' }],
      }),
      NOTIONS,
      executeur,
    )

    expect(essai(essais, 'solution')?.verdict).toBe('vert')
    expect(executeur.executer).toHaveBeenCalledWith(
      expect.objectContaining({ entrees: [], nomsVariables: ['age'] }),
    )
  })

  it("ne relance pas Pyodide pour deux tests aux mêmes entrées", async () => {
    // Pyodide met des secondes à répondre : relancer pour rien rendrait la
    // batterie insupportable sur un exercice à cinq tests.
    const executeur = {
      executer: vi.fn(async () => ({
        stdout: 'Vrai',
        erreur: null,
        variables: {},
        dureeMs: 1,
        timeout: false,
      })),
      detruire: vi.fn(),
    } as unknown as Executeur

    await eprouver(
      brouillon({
        tests: [
          { type: 'sortie', entrees: ['a'], attendu: 'Vrai' },
          { type: 'sortie', entrees: ['a'], attendu: 'Vrai' },
          { type: 'sortie', entrees: ['b'], attendu: 'Vrai' },
        ],
      }),
      NOTIONS,
      executeur,
    )

    // Deux jeux d'entrées distincts, deux exécutions — pas trois.
    expect(executeur.executer).toHaveBeenCalledTimes(2)
  })

  it("signale une prédiction dont la solution tourne en rond", async () => {
    const essais = await eprouver(
      brouillon({
        type: 'predire',
        tests: [{ type: 'qcm', options: ['5'], bonneReponse: 0 }],
        solution: 'while True:\n    pass',
      }),
      NOTIONS,
      executeurFactice({ 'while True:\n    pass': { timeout: true } }),
    )
    const trouve = essai(essais, 'produit')
    expect(trouve?.verdict).toBe('rouge')
    expect(trouve?.detail).toMatch(/ne s’arrête pas/)
  })
})

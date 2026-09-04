import { describe, expect, it } from 'vitest'
import { evaluer } from '../../src/validation/evaluer'
import type { ResultatExecution } from '../../src/execution/types'

const execution = (p: Partial<ResultatExecution> = {}): ResultatExecution => ({
  stdout: '',
  erreur: null,
  variables: {},
  dureeMs: 12,
  timeout: false,
  ...p,
})

describe('evaluer', () => {
  it('rend VERT quand la sortie est exacte', () => {
    const r = evaluer({
      code: 'print("Bonjour Camille")',
      tests: [{ type: 'sortie', entrees: [], attendu: 'Bonjour Camille' }],
      executions: [execution({ stdout: 'Bonjour Camille\n' })],
    })
    expect(r.verdict).toBe('vert')
  })

  it('rend BLEU quand seul le format differe, et fournit un diff', () => {
    const r = evaluer({
      code: 'print("bonjour  camille")',
      tests: [{ type: 'sortie', entrees: [], attendu: 'Bonjour Camille' }],
      executions: [execution({ stdout: 'bonjour  camille\n' })],
    })
    expect(r.verdict).toBe('bleu')
    expect(r.diff).toBeDefined()
    expect(r.titre).toMatch(/logique/i)
  })

  it('rend ROUGE quand la sortie est vraiment differente', () => {
    const r = evaluer({
      code: 'print("Bonjour")',
      tests: [{ type: 'sortie', entrees: [], attendu: 'Bonjour Camille' }],
      executions: [execution({ stdout: 'Bonjour\n' })],
    })
    expect(r.verdict).toBe('rouge')
  })

  it('exige le VERT quand exigeExact est vrai', () => {
    const r = evaluer({
      code: 'print("bonjour camille")',
      tests: [{ type: 'sortie', entrees: [], attendu: 'Bonjour Camille', exigeExact: true }],
      executions: [execution({ stdout: 'bonjour camille\n' })],
    })
    expect(r.verdict).toBe('rouge')
  })

  it('rend ROUGE et traduit l erreur quand le programme leve une exception', () => {
    const r = evaluer({
      code: 'print(nom)',
      tests: [{ type: 'sortie', entrees: [], attendu: 'x' }],
      executions: [
        execution({
          erreur: { type: 'NameError', message: "name 'nom' is not defined", ligne: 1 },
        }),
      ],
    })
    expect(r.verdict).toBe('rouge')
    expect(r.titre).toContain('nom')
  })

  it('verifie le type d une variable', () => {
    const r = evaluer({
      code: 'age = 17',
      tests: [{ type: 'variable', nom: 'age', typeAttendu: 'int' }],
      executions: [execution({ variables: { age: { valeur: '17', type: 'int' } } })],
    })
    expect(r.verdict).toBe('vert')
  })

  it('signale le piege du nombre ecrit entre guillemets', () => {
    const r = evaluer({
      code: 'age = "17"',
      tests: [{ type: 'variable', nom: 'age', typeAttendu: 'int' }],
      executions: [execution({ variables: { age: { valeur: "'17'", type: 'str' } } })],
    })
    expect(r.verdict).toBe('rouge')
    expect(r.detail).toMatch(/guillemets/i)
  })

  it('rejette un motif interdit avant tout autre test', () => {
    const exec = execution({ stdout: 'Bonjour Camille\n' })
    const r = evaluer({
      code: 'print("Bonjour Camille")',
      tests: [
        { type: 'interdit', motif: 'print("Bonjour' },
        { type: 'sortie', entrees: [], attendu: 'Bonjour Camille' },
      ],
      executions: [exec, exec],
    })
    expect(r.verdict).toBe('rouge')
    expect(r.titre).toMatch(/en dur|directement/i)
  })

  it('exige un motif obligatoire', () => {
    const r = evaluer({
      code: 'print(1)\nprint(2)',
      tests: [{ type: 'contient', motif: 'for ' }],
      executions: [execution({ stdout: '1\n2\n' })],
    })
    expect(r.verdict).toBe('rouge')
  })

  it('valide un qcm sur la bonne reponse', () => {
    const tests = [{ type: 'qcm' as const, options: ['a', 'b'], bonneReponse: 1 }]
    expect(
      evaluer({ code: '', tests, executions: [execution()], reponseQcm: 1 }).verdict,
    ).toBe('vert')
    expect(
      evaluer({ code: '', tests, executions: [execution()], reponseQcm: 0 }).verdict,
    ).toBe('rouge')
  })

  it('n affiche qu un seul echec a la fois', () => {
    const exec = execution({ variables: {} })
    const r = evaluer({
      code: 'x = 1',
      tests: [
        { type: 'variable', nom: 'a', typeAttendu: 'int' },
        { type: 'variable', nom: 'b', typeAttendu: 'int' },
      ],
      executions: [exec, exec],
    })
    expect(r.titre).toContain('a')
    // Note : `not.toContain('b')` échouerait toujours, car le mot « variable »
    // contient lui-même un « b » — voir le rapport de tâche pour le détail.
    expect(r.titre).not.toMatch(/\bb\b/)
  })

  it('rend BLEU global si un test est bleu et les autres verts', () => {
    const exec = execution({
      stdout: 'bonjour camille\n',
      variables: { nom: { valeur: "'Camille'", type: 'str' } },
    })
    const r = evaluer({
      code: 'nom = "Camille"\nprint("bonjour camille")',
      tests: [
        { type: 'variable', nom: 'nom', typeAttendu: 'str' },
        { type: 'sortie', entrees: [], attendu: 'Bonjour Camille' },
      ],
      executions: [exec, exec],
    })
    expect(r.verdict).toBe('bleu')
  })

  it('confronte chaque test sortie a SA propre execution, pas a celle du premier', () => {
    // Reproduit s1-30 : deux tests 'sortie' avec des entrees differentes.
    // Avant la correction, une seule execution (celle du premier test) etait
    // partagee : le second test comparait alors sa sortie a un attendu ecrit
    // pour d'autres entrees, et une solution correcte etait rejetee a tort.
    const r = evaluer({
      code: 'missions = int(input("Nombre de missions accomplies : "))\nprint("Apres celle-ci, tu en auras", missions + 1)',
      tests: [
        {
          type: 'sortie',
          entrees: ['12'],
          attendu: 'Nombre de missions accomplies : 12\nApres celle-ci, tu en auras 13',
        },
        {
          type: 'sortie',
          entrees: ['3'],
          attendu: 'Nombre de missions accomplies : 3\nApres celle-ci, tu en auras 4',
        },
      ],
      executions: [
        execution({ stdout: 'Nombre de missions accomplies : 12\nApres celle-ci, tu en auras 13\n' }),
        execution({ stdout: 'Nombre de missions accomplies : 3\nApres celle-ci, tu en auras 4\n' }),
      ],
    })
    expect(r.verdict).toBe('vert')
  })
})

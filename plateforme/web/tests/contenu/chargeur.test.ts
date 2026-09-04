import { describe, expect, it, vi } from 'vitest'
import { nomsVariablesRequis } from '../../src/contenu/chargeur'
import type { Exercice } from '../../src/contenu/types'

const exercice = (tests: Exercice['tests']): Exercice => ({
  id: 's1-10',
  concept: 'variables',
  notion: 'variables',
  famille: 'variables',
  seance: 1,
  niveau: 'normal',
  type: 'completer',
  titre: 'Range un prenom',
  obligatoire: true,
  enonce: '',
  depart: '',
  indices: [],
  tests,
})

describe('nomsVariablesRequis', () => {
  it('collecte les noms des tests variable', () => {
    const ex = exercice([
      { type: 'variable', nom: 'nom', typeAttendu: 'str' },
      { type: 'variable', nom: 'age', typeAttendu: 'int' },
      { type: 'sortie', entrees: [], attendu: 'x' },
    ])
    expect(nomsVariablesRequis(ex)).toEqual(['age', 'nom'])
  })

  it('renvoie un tableau vide sans test variable', () => {
    expect(nomsVariablesRequis(exercice([{ type: 'sortie', entrees: [], attendu: 'x' }]))).toEqual([])
  })

  it('dedoublonne', () => {
    const ex = exercice([
      { type: 'variable', nom: 'age', typeAttendu: 'int' },
      { type: 'variable', nom: 'age', valeurAttendue: '17' },
    ])
    expect(nomsVariablesRequis(ex)).toEqual(['age'])
  })
})

describe('chargerJson', () => {
  it('rend le contenu servi en statique', async () => {
    const { chargerJson } = await import('../../src/contenu/chargeur')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => [{ id: 's1-01' }] })),
    )
    await expect(chargerJson('/contenu/seance-1.json')).resolves.toEqual([{ id: 's1-01' }])
    vi.unstubAllGlobals()
  })

  it('leve avec le code HTTP quand le fichier manque', async () => {
    // Un 404 silencieux donnerait un ecran vide sans explication : l'eleve
    // croirait a un bug de son cote.
    const { chargerJson } = await import('../../src/contenu/chargeur')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(chargerJson('/contenu/absent.json')).rejects.toThrow(/404/)
    vi.unstubAllGlobals()
  })

  it('chaque chargeur vise son propre fichier', async () => {
    const { chargerParcours, chargerNotions, chargerLecons } = await import(
      '../../src/contenu/chargeur'
    )
    const factice = vi.fn(async (_chemin: string) => ({ ok: true, json: async () => [] }))
    vi.stubGlobal('fetch', factice)

    await chargerParcours()
    await chargerNotions()
    await chargerLecons()

    expect(factice.mock.calls.map((c) => c[0])).toEqual([
      '/contenu/seance-1.json',
      '/contenu/seance-1-notions.json',
      '/contenu/seance-1-lecons.json',
    ])
    vi.unstubAllGlobals()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chargerSchema, valeursDe, type SchemaPublie } from '../../src/atelier/schema'

const SCHEMA: SchemaPublie = {
  exercice: {
    properties: {
      type: { enum: ['predire', 'debug', 'completer', 'ecrire'] },
      niveau: { enum: ['normal', 'expert'] },
      titre: {},
    },
    required: ['id', 'titre'],
  },
  lecon: {},
}

beforeEach(() => vi.unstubAllGlobals())

describe('chargerSchema', () => {
  it('rend le schéma publié', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => SCHEMA })))
    expect((await chargerSchema()).exercice.required).toEqual(['id', 'titre'])
  })

  it("refuse un fichier qui n'a pas la forme d'un schéma", async () => {
    // Glissé dans l'état, il ferait planter le formulaire au premier rendu.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ autre: 1 }) })))
    await expect(chargerSchema()).rejects.toThrow('Schéma illisible.')
  })

  it('remonte une absence de fichier', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(chargerSchema()).rejects.toThrow(/404/)
  })
})

describe('valeursDe', () => {
  it("rend l'énumération dans l'ordre du schéma", () => {
    // L'ordre est pédagogique — predire, debug, completer, ecrire — pas
    // alphabétique. Le trier ici le perdrait.
    expect(valeursDe(SCHEMA, 'type')).toEqual(['predire', 'debug', 'completer', 'ecrire'])
    expect(valeursDe(SCHEMA, 'niveau')).toEqual(['normal', 'expert'])
  })

  it("rend une liste vide pour un champ libre, sans casser", () => {
    expect(valeursDe(SCHEMA, 'titre')).toEqual([])
    expect(valeursDe(SCHEMA, 'inconnu')).toEqual([])
  })
})

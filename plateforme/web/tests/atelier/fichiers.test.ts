import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enregistrerEnPlace,
  peutEnregistrerEnPlace,
  telecharger,
} from '../../src/atelier/fichiers'

beforeEach(() => vi.unstubAllGlobals())

describe('peutEnregistrerEnPlace', () => {
  it("dit non quand le navigateur n'expose rien", () => {
    expect(peutEnregistrerEnPlace()).toBe(false)
  })

  it('dit oui quand le sélecteur existe', () => {
    vi.stubGlobal('showSaveFilePicker', vi.fn())
    expect(peutEnregistrerEnPlace()).toBe(true)
  })
})

describe('telecharger', () => {
  it('crée un lien, le clique, et libère la mémoire', () => {
    const creer = vi.fn(() => 'blob:essai')
    const revoquer = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: creer, revokeObjectURL: revoquer })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    telecharger('s2-14.yaml', 'id: s2-14\n')

    expect(creer).toHaveBeenCalledOnce()
    expect(clic).toHaveBeenCalledOnce()
    // Sans révocation, on garde un exercice en mémoire par fichier produit.
    expect(revoquer).toHaveBeenCalledWith('blob:essai')
    clic.mockRestore()
  })
})

describe('enregistrerEnPlace', () => {
  function selecteurQuiEcrit() {
    const ecrit: string[] = []
    const ferme = vi.fn()
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => ({
        createWritable: async () => ({
          write: async (t: string) => void ecrit.push(t),
          close: ferme,
        }),
      })),
    )
    return { ecrit, ferme }
  }

  it('écrit le fichier et ferme le flux', async () => {
    const { ecrit, ferme } = selecteurQuiEcrit()
    await expect(enregistrerEnPlace('s2-14.yaml', 'id: s2-14\n')).resolves.toBe('enregistre')
    expect(ecrit).toEqual(['id: s2-14\n'])
    expect(ferme).toHaveBeenCalledOnce()
  })

  it('propose le bon nom de fichier', async () => {
    selecteurQuiEcrit()
    await enregistrerEnPlace('s2-14.yaml', 'x')
    const appel = (globalThis as unknown as { showSaveFilePicker: ReturnType<typeof vi.fn> })
      .showSaveFilePicker.mock.calls[0]![0]
    expect(appel.suggestedName).toBe('s2-14.yaml')
  })

  it("ne prend pas une annulation pour une panne", async () => {
    // Fermer la fenêtre de choix est un geste volontaire : une alerte rouge
    // pour ça serait un reproche.
    const abandon = new Error('abandon')
    abandon.name = 'AbortError'
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => { throw abandon }))

    await expect(enregistrerEnPlace('s2-14.yaml', 'x')).resolves.toBe('annule')
  })

  it('laisse remonter une vraie panne', async () => {
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => { throw new Error('disque plein') }))
    await expect(enregistrerEnPlace('s2-14.yaml', 'x')).rejects.toThrow('disque plein')
  })
})

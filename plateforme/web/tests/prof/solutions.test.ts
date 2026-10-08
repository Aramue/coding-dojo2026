import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lireSolutions } from '../../src/prof/solutions'

function repondre(status: number, corps: unknown = {}) {
  const appel = vi.fn(async () => ({ ok: status < 400, status, json: async () => corps }))
  vi.stubGlobal('fetch', appel)
  return appel
}

beforeEach(() => vi.unstubAllGlobals())

describe('lireSolutions', () => {
  it('lit les solutions avec le jeton professeur, jamais sans', async () => {
    const appel = repondre(200, { solutions: { 's1-01': 'print("Bonjour")' } })
    expect(await lireSolutions('prof.1.abc')).toEqual({ 's1-01': 'print("Bonjour")' })
    const [url, init] = appel.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/prof/solutions')
    expect(init.headers).toEqual({ 'X-Jeton-Prof': 'prof.1.abc' })
  })

  it('le dit quand la session est refusée', async () => {
    repondre(401)
    await expect(lireSolutions('prof.1.abc')).rejects.toThrow(/erreur 401/)
  })

  it.each([
    [{}],
    [{ solutions: null }],
    [{ solutions: ['print()'] }],
    [{ solutions: { 's1-01': 42 } }],
  ])("refuse une réponse qui n'a pas la forme attendue : %j", async (corps) => {
    // Une solution qui ne serait pas un texte ferait un écran blanc au premier
    // `.trimEnd()` du rendu, au milieu d'une séance.
    repondre(200, corps)
    await expect(lireSolutions('prof.1.abc')).rejects.toThrow(/inattendue/)
  })

  it("ne range rien dans le navigateur : la machine de la salle sert aussi aux élèves", async () => {
    repondre(200, { solutions: { 's1-01': 'print("Bonjour")' } })
    sessionStorage.clear()
    localStorage.clear()
    await lireSolutions('prof.1.abc')
    expect(sessionStorage.length + localStorage.length).toBe(0)
  })
})

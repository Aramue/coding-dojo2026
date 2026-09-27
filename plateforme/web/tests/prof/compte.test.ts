import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compteExiste, creerCompte, seConnecter } from '../../src/prof/compte'

function repondre(status: number, corps: unknown = {}) {
  const appel = vi.fn(async () => ({ ok: status < 400, status, json: async () => corps }))
  vi.stubGlobal('fetch', appel)
  return appel
}

beforeEach(() => vi.unstubAllGlobals())

describe('compteExiste', () => {
  it('dit si le compte existe', async () => {
    repondre(200, { existe: true })
    expect(await compteExiste()).toBe(true)
    repondre(200, { existe: false })
    expect(await compteExiste()).toBe(false)
  })

  it("refuse une réponse qui n'est pas un booléen", async () => {
    // Un `undefined` pris pour « aucun compte » proposerait d'en créer un
    // second, que le serveur refuserait : mieux vaut le dire tout de suite.
    repondre(200, { existe: 'oui' })
    await expect(compteExiste()).rejects.toThrow(/inattendue/)
  })

  it('dit quand la plateforme ne répond pas', async () => {
    repondre(502)
    await expect(compteExiste()).rejects.toThrow(/ne répond pas/)
  })
})

describe('creerCompte et seConnecter', () => {
  it('envoient le mot de passe une fois, en POST, et rendent le jeton', async () => {
    const appel = repondre(201, { jeton: 'prof.1.abc' })
    expect(await creerCompte('mot-de-passe-long')).toBe('prof.1.abc')
    const [url, init] = appel.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/prof/compte')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ mot_de_passe: 'mot-de-passe-long' })

    repondre(200, { jeton: 'prof.2.def' })
    expect(await seConnecter('mot-de-passe-long')).toBe('prof.2.def')
  })

  it.each([
    [401, /incorrect/],
    [404, /Aucun compte/],
    [409, /existe déjà/],
    [422, /au moins 12 caractères/],
    [500, /erreur 500/],
  ])('traduit le statut %i', async (status, message) => {
    repondre(status)
    await expect(seConnecter('mot-de-passe-long')).rejects.toThrow(message)
  })

  it('refuse une réponse sans jeton', async () => {
    repondre(200, {})
    await expect(seConnecter('mot-de-passe-long')).rejects.toThrow(/inattendue/)
  })
})

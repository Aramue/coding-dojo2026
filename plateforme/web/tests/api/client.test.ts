import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientApi } from '../../src/api/client'

describe('ClientApi', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('ouvre une session et memorise le jeton', async () => {
    const fetchFactice = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jeton: 'AGENT-K7M2.sig', code_agent: 'AGENT-K7M2' }),
    })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('AGENT-K7M2')

    await client.lireParcours()
    const entetes = fetchFactice.mock.calls[1]![1].headers
    expect(entetes.Authorization).toBe('Bearer AGENT-K7M2.sig')
  })

  it('leve une erreur explicite sur un code refuse', async () => {
    const fetchFactice = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await expect(client.ouvrirSession('toto')).rejects.toThrow(/code d'agent/i)
  })

  it('n envoie jamais de code source dans une tentative', async () => {
    const fetchFactice = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jeton: 'j', code_agent: 'a' }) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('AGENT-K7M2')
    await client.enregistrerTentative({ exerciceId: 's1-01', verdict: 'vert', typeErreur: null, dureeMs: 12 })

    const corps = JSON.parse(fetchFactice.mock.calls[1]![1].body)
    expect(Object.keys(corps).sort()).toEqual(['duree_ms', 'exercice_id', 'type_erreur', 'verdict'])
  })

  it('leve quand l enregistrement echoue, pour ne pas faire avancer l eleve a tort', async () => {
    const fetchFactice = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jeton: 'j', code_agent: 'a' }) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('AGENT-K7M2')

    await expect(
      client.enregistrerTentative({ exerciceId: 's1-01', verdict: 'vert', typeErreur: null, dureeMs: 12 }),
    ).rejects.toThrow(/enregistr/i)
  })

  it('distingue une panne de plateforme d un code d agent refuse', async () => {
    const enPanne = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      new ClientApi('/api', enPanne as unknown as typeof fetch).ouvrirSession('AGENT-K7M2'),
    ).rejects.toThrow(/ne répond pas/i)

    const refuse = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) })
    await expect(
      new ClientApi('/api', refuse as unknown as typeof fetch).ouvrirSession('toto'),
    ).rejects.toThrow(/code d'agent/i)
  })
})

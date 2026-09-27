import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientApi } from '../../src/api/client'

describe('ClientApi', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('ouvre une session et memorise le jeton', async () => {
    const fetchFactice = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jeton: 'DOJO-K7M2.sig', code_acces: 'DOJO-K7M2' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reussis: [] }) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('DOJO-K7M2')

    await client.lireParcours()
    const entetes = fetchFactice.mock.calls[1]![1].headers
    expect(entetes.Authorization).toBe('Bearer DOJO-K7M2.sig')
  })

  it('leve une erreur explicite sur un code refuse', async () => {
    const fetchFactice = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await expect(client.ouvrirSession('toto')).rejects.toThrow(/code d'accès/i)
  })

  it('n envoie jamais de code source dans une tentative', async () => {
    const fetchFactice = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jeton: 'j', code_acces: 'a' }) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('DOJO-K7M2')
    await client.enregistrerTentative({ exerciceId: 's1-01', verdict: 'vert', typeErreur: null, dureeMs: 12 })

    const corps = JSON.parse(fetchFactice.mock.calls[1]![1].body)
    expect(Object.keys(corps).sort()).toEqual(['duree_ms', 'exercice_id', 'type_erreur', 'verdict'])
  })

  it('leve quand l enregistrement echoue, pour ne pas faire avancer l eleve a tort', async () => {
    const fetchFactice = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jeton: 'j', code_acces: 'a' }) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('DOJO-K7M2')

    await expect(
      client.enregistrerTentative({ exerciceId: 's1-01', verdict: 'vert', typeErreur: null, dureeMs: 12 }),
    ).rejects.toThrow(/enregistr/i)
  })

  it('distingue une panne de plateforme d un code d acces refuse', async () => {
    const enPanne = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      new ClientApi('/api', enPanne as unknown as typeof fetch).ouvrirSession('DOJO-K7M2'),
    ).rejects.toThrow(/ne répond pas/i)

    const refuse = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) })
    await expect(
      new ClientApi('/api', refuse as unknown as typeof fetch).ouvrirSession('toto'),
    ).rejects.toThrow(/code d'accès/i)
  })
})

describe('ClientApi — identite', () => {
  function reponse(corps: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => corps }
  }

  it('rend le code et le prenom', async () => {
    const fetchFactice = vi
      .fn()
      .mockResolvedValue(reponse({ jeton: 'j', code_acces: 'DOJO-K7M2', prenom: 'Camille' }))
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    expect(await client.ouvrirSession('DOJO-K7M2')).toEqual({
      codeAcces: 'DOJO-K7M2',
      prenom: 'Camille',
    })
  })

  it("rend un prenom vide quand l API n'en donne pas", async () => {
    const fetchFactice = vi.fn().mockResolvedValue(reponse({ jeton: 'j', code_acces: 'DOJO-K7M2' }))
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    expect((await client.ouvrirSession('DOJO-K7M2')).prenom).toBe('')
  })

  it('distingue un code mal forme d un code qui n existe pas', async () => {
    // Sans cette distinction, l'eleve relit vingt fois un code correctement
    // tape qui n'a simplement jamais ete cree.
    const malForme = vi.fn().mockResolvedValue(reponse({}, 422))
    await expect(
      new ClientApi('/api', malForme as unknown as typeof fetch).ouvrirSession('toto'),
    ).rejects.toThrow(/forme DOJO-XXXX/)

    const inexistant = vi.fn().mockResolvedValue(reponse({}, 404))
    await expect(
      new ClientApi('/api', inexistant as unknown as typeof fetch).ouvrirSession('DOJO-ZZZZ'),
    ).rejects.toThrow(/n'existe pas/)
  })
})

describe('ClientApi — les pannes de la plateforme', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('distingue une panne serveur d un code refuse', async () => {
    // 422 dit « ton code est faux », 500 dit « ce n'est pas toi ». Confondre
    // les deux envoie l'élève vérifier un code parfaitement valide.
    const fetchFactice = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await expect(client.ouvrirSession('DOJO-K7M2')).rejects.toThrow(/plateforme a un problème/i)
  })

  it('dit quand une tentative n a pas ete enregistree', async () => {
    const fetchFactice = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jeton: 'j', code_acces: 'a' }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('DOJO-K7M2')

    await expect(
      client.enregistrerTentative({ exerciceId: 's1-01', verdict: 'vert', typeErreur: null, dureeMs: 12 }),
    ).rejects.toThrow(/erreur 503/)
  })
})

describe('ClientApi — le reseau qui tombe pendant une tentative', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('distingue le reseau muet d un refus du serveur', async () => {
    // Deux messages différents pour deux causes différentes : « ça n'est pas
    // parti » n'appelle pas la même réaction que « le serveur a dit non ».
    const fetchFactice = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jeton: 'j', code_acces: 'a' }) })
      .mockRejectedValueOnce(new Error('réseau coupé'))
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('DOJO-K7M2')

    await expect(
      client.enregistrerTentative({ exerciceId: 's1-01', verdict: 'vert', typeErreur: null, dureeMs: 12 }),
    ).rejects.toThrow(/ne répond pas/)
  })
})

describe('ClientApi — sans session ouverte', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('refuse de lire un parcours avant d avoir un jeton', async () => {
    // Sans cette garde, la requête partirait sans en-tête et le serveur
    // répondrait 401 : un aller-retour pour dire ce qu'on savait déjà.
    const client = new ClientApi('/api', vi.fn() as unknown as typeof fetch)
    await expect(client.lireParcours()).rejects.toThrow('Session non ouverte.')
  })

  it('dit quand le parcours revient dans une forme inattendue', async () => {
    const fetchFactice = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jeton: 'j', code_acces: 'a' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reussis: 'pas un tableau' }) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('DOJO-K7M2')

    await expect(client.lireParcours()).rejects.toThrow('Progression indisponible.')
  })

  it('dit quand le parcours est refuse', async () => {
    const fetchFactice = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jeton: 'j', code_acces: 'a' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('DOJO-K7M2')

    await expect(client.lireParcours()).rejects.toThrow('Progression indisponible.')
  })
})

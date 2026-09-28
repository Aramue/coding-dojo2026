import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  corriger,
  creerPartie,
  lirePartie,
  listerQuiz,
  questionSuivante,
  SessionProfRefusee,
  terminerPartie,
} from '../../src/prof/quiz'

const ETAT = { partie: 3, maintenant: '2026-09-30T14:00:00+00:00', phase: 'attente' }

function reponse(corps: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => corps }
}

let fetchFactice: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchFactice = vi.fn()
  vi.stubGlobal('fetch', fetchFactice)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('client du quiz, côté professeur', () => {
  it('porte le jeton de la session professeur sur chaque appel', async () => {
    fetchFactice.mockResolvedValue(reponse(ETAT))
    await lirePartie('jeton-prof')
    const [url, options] = fetchFactice.mock.calls[0]!
    expect(url).toBe('/api/prof/quiz/partie')
    expect(options.headers['X-Jeton-Prof']).toBe('jeton-prof')
  })

  it('liste le catalogue', async () => {
    const quiz = [{ id: 'q1-bases', titre: 'Les bases', seance: 1, questions: 12, duree_s: 280 }]
    fetchFactice.mockResolvedValue(reponse({ quiz }))
    expect(await listerQuiz('jeton-prof')).toEqual(quiz)
    expect(fetchFactice.mock.calls[0]![0]).toBe('/api/prof/quiz')
  })

  it('refuse un catalogue d une autre forme', async () => {
    fetchFactice.mockResolvedValue(reponse({ autre: 1 }))
    await expect(listerQuiz('jeton-prof')).rejects.toThrow(/inattendue/)
  })

  it('crée une partie à partir d un quiz', async () => {
    fetchFactice.mockResolvedValue(reponse(ETAT, 201))
    await creerPartie('jeton-prof', 'q1-bases')
    const [url, options] = fetchFactice.mock.calls[0]!
    expect(url).toBe('/api/prof/quiz/parties')
    expect(JSON.parse(options.body)).toEqual({ quiz_id: 'q1-bases' })
  })

  it('rappelle la question qu il croit courante à chaque action', async () => {
    fetchFactice.mockResolvedValue(reponse(ETAT))
    await questionSuivante('jeton-prof', -1)
    await corriger('jeton-prof', 4)
    await terminerPartie('jeton-prof')
    const appels = fetchFactice.mock.calls.map(([url, options]) => [url, options.body])
    expect(appels).toEqual([
      ['/api/prof/quiz/partie/suivante', '{"question":-1}'],
      ['/api/prof/quiz/partie/corriger', '{"question":4}'],
      ['/api/prof/quiz/partie/terminer', undefined],
    ])
  })

  it('montre le refus du serveur, écrit pour être lu', async () => {
    fetchFactice.mockResolvedValue(reponse({ detail: 'La partie a déjà avancé.' }, 409))
    await expect(questionSuivante('jeton-prof', 0)).rejects.toThrow('La partie a déjà avancé.')
  })

  it('signale une session refusée ou expirée, pour rendre la main à la porte', async () => {
    fetchFactice.mockResolvedValue(reponse({ detail: 'Session professeur absente ou expiree' }, 401))
    await expect(lirePartie('perime')).rejects.toBeInstanceOf(SessionProfRefusee)
    await expect(lirePartie('perime')).rejects.toThrow(/reconnecte-toi/)
  })

  it('distingue la panne du refus', async () => {
    fetchFactice.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(lirePartie('jeton-prof')).rejects.toThrow('La plateforme ne répond pas.')
  })

  it('tolère un corps illisible dans une erreur', async () => {
    fetchFactice.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('pas du json')
      },
    })
    await expect(lirePartie('jeton-prof')).rejects.toThrow('La plateforme a refusé (erreur 502).')
  })

  it('refuse une photographie d une autre forme', async () => {
    fetchFactice.mockResolvedValue(reponse(null))
    await expect(lirePartie('jeton-prof')).rejects.toThrow(/inattendue/)
  })
})

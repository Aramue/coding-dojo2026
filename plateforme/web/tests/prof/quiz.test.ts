import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  corriger,
  creerPartie,
  lirePartie,
  listerQuiz,
  questionSuivante,
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
  it('porte le code professeur sur chaque appel', async () => {
    fetchFactice.mockResolvedValue(reponse(ETAT))
    await lirePartie('code-prof')
    const [url, options] = fetchFactice.mock.calls[0]!
    expect(url).toBe('/api/prof/quiz/partie')
    expect(options.headers['X-Code-Prof']).toBe('code-prof')
  })

  it('liste le catalogue', async () => {
    const quiz = [{ id: 'q1-bases', titre: 'Les bases', seance: 1, questions: 12, duree_s: 280 }]
    fetchFactice.mockResolvedValue(reponse({ quiz }))
    expect(await listerQuiz('code-prof')).toEqual(quiz)
    expect(fetchFactice.mock.calls[0]![0]).toBe('/api/prof/quiz')
  })

  it('refuse un catalogue d une autre forme', async () => {
    fetchFactice.mockResolvedValue(reponse({ autre: 1 }))
    await expect(listerQuiz('code-prof')).rejects.toThrow(/inattendue/)
  })

  it('crée une partie à partir d un quiz', async () => {
    fetchFactice.mockResolvedValue(reponse(ETAT, 201))
    await creerPartie('code-prof', 'q1-bases')
    const [url, options] = fetchFactice.mock.calls[0]!
    expect(url).toBe('/api/prof/quiz/parties')
    expect(JSON.parse(options.body)).toEqual({ quiz_id: 'q1-bases' })
  })

  it('rappelle la question qu il croit courante à chaque action', async () => {
    fetchFactice.mockResolvedValue(reponse(ETAT))
    await questionSuivante('code-prof', -1)
    await corriger('code-prof', 4)
    await terminerPartie('code-prof')
    const appels = fetchFactice.mock.calls.map(([url, options]) => [url, options.body])
    expect(appels).toEqual([
      ['/api/prof/quiz/partie/suivante', '{"question":-1}'],
      ['/api/prof/quiz/partie/corriger', '{"question":4}'],
      ['/api/prof/quiz/partie/terminer', undefined],
    ])
  })

  it('montre le refus du serveur, écrit pour être lu', async () => {
    fetchFactice.mockResolvedValue(reponse({ detail: 'La partie a déjà avancé.' }, 409))
    await expect(questionSuivante('code-prof', 0)).rejects.toThrow('La partie a déjà avancé.')
  })

  it('distingue un code professeur refusé', async () => {
    fetchFactice.mockResolvedValue(reponse({ detail: 'Code professeur invalide' }, 401))
    await expect(lirePartie('faux')).rejects.toThrow('Code professeur refusé.')
  })

  it('distingue la panne du refus', async () => {
    fetchFactice.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(lirePartie('code-prof')).rejects.toThrow('La plateforme ne répond pas.')
  })

  it('tolère un corps illisible dans une erreur', async () => {
    fetchFactice.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('pas du json')
      },
    })
    await expect(lirePartie('code-prof')).rejects.toThrow('La plateforme a refusé (erreur 502).')
  })

  it('refuse une photographie d une autre forme', async () => {
    fetchFactice.mockResolvedValue(reponse(null))
    await expect(lirePartie('code-prof')).rejects.toThrow(/inattendue/)
  })
})

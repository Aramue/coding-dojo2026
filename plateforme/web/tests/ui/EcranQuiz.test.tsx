import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientApi } from '../../src/api/client'
import type { EtatEleve } from '../../src/quiz/types'
import { EcranQuiz } from '../../src/ui/EcranQuiz'
import { etatEleve, poserSonnetteMuette, question, reponse } from './quiz-outillage'

let etat: EtatEleve
let apresAction: unknown
let fetchFactice: ReturnType<typeof vi.fn>

async function monter() {
  fetchFactice = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/session')) return reponse({ jeton: 'DOJO-K7M2.sig', code_acces: 'DOJO-K7M2' })
    if (url.endsWith('/quiz/etat')) return reponse(etat)
    if (options?.method === 'POST') {
      // Comme le serveur : une action acceptée change ce que la relecture rend.
      const action = apresAction as ReturnType<typeof reponse>
      const corps = await action.json()
      if (action.ok) etat = corps as typeof etat
      return reponse(corps, action.status)
    }
    throw new Error(`appel inattendu : ${url}`)
  })
  const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
  await client.ouvrirSession('DOJO-K7M2')
  render(<EcranQuiz client={client} />)
}

function corpsDu(chemin: string) {
  const appel = fetchFactice.mock.calls.find(([url]) => String(url).endsWith(chemin))
  return appel ? JSON.parse(String(appel[1].body ?? 'null')) : undefined
}

beforeEach(() => {
  poserSonnetteMuette()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EcranQuiz', () => {
  it('dit qu il n y a pas de quiz, sans laisser l élève sans issue', async () => {
    etat = { partie: null, maintenant: new Date().toISOString() }
    await monter()
    expect(await screen.findByRole('heading', { name: 'Aucun quiz en cours' })).toBeInTheDocument()
    expect(screen.getByText(/continuer tes exercices/)).toBeInTheDocument()
  })

  it('invite à rejoindre une partie, puis attend la première question', async () => {
    etat = etatEleve({ rejoint: false, moi: null })
    apresAction = reponse(etatEleve())
    await monter()

    await userEvent.click(await screen.findByRole('button', { name: 'Rejoindre la partie' }))
    expect(await screen.findByText(/Tu es dans la partie/)).toBeInTheDocument()
    expect(screen.getByText('3 élèves prêts')).toBeInTheDocument()
    expect(fetchFactice.mock.calls.some(([url]) => String(url).endsWith('/quiz/rejoindre'))).toBe(true)
  })

  it('propose de rejoindre en cours de route une partie déjà lancée', async () => {
    etat = etatEleve({ rejoint: false, moi: null, phase: 'question', question: question() })
    await monter()
    expect(await screen.findByText(/rejoindre en cours de route/)).toBeInTheDocument()
  })

  it('montre la question, le code et le temps, et répond d un clic', async () => {
    etat = etatEleve({ phase: 'question', question: question() })
    apresAction = reponse(etatEleve({ phase: 'question', question: question(), ma_reponse: { choix: 1 } }))
    await monter()

    expect(await screen.findByRole('heading', { name: "Qu'affiche ce programme ?" })).toBeInTheDocument()
    expect(screen.getByText('print("2" + "2")')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/secondes restantes/)

    await userEvent.click(screen.getByRole('button', { name: /B\s*22/ }))
    expect(corpsDu('/quiz/reponse')).toEqual({ partie: 1, question: 0, choix: 1 })
    expect(await screen.findByText(/Réponse enregistrée/)).toBeInTheDocument()
    for (const bouton of screen.getAllByRole('button', { pressed: false })) {
      expect(bouton).toBeDisabled()
    }
    expect(screen.getByRole('button', { pressed: true })).toHaveAccessibleName(/ta réponse/)
  })

  it('répond au clavier, touches 1 à 4', async () => {
    etat = etatEleve({ phase: 'question', question: question() })
    apresAction = reponse(etatEleve({ phase: 'question', question: question(), ma_reponse: { choix: 2 } }))
    await monter()
    await screen.findByRole('timer')

    await userEvent.keyboard('9')
    expect(corpsDu('/quiz/reponse')).toBeUndefined()
    await userEvent.keyboard('3')
    expect(corpsDu('/quiz/reponse')).toEqual({ partie: 1, question: 0, choix: 2 })
  })

  it('montre tel quel un refus écrit pour l élève', async () => {
    etat = etatEleve({ phase: 'question', question: question() })
    apresAction = reponse({ detail: 'Le temps de réponse est écoulé.' }, 409)
    await monter()
    await userEvent.click(await screen.findByRole('button', { name: /A\s*4/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Le temps de réponse est écoulé.')
  })

  it('verrouille les options quand le temps est écoulé', async () => {
    const passee = question({ fin_a: new Date(Date.now() - 1_000).toISOString() })
    etat = etatEleve({ phase: 'question', question: passee })
    await monter()
    expect(await screen.findByText('Temps écoulé.')).toBeInTheDocument()
    for (const bouton of screen.getAllByRole('button')) expect(bouton).toBeDisabled()
  })

  it('à la correction, dit si c était juste, pourquoi, et où il en est', async () => {
    etat = etatEleve({
      phase: 'correction',
      question: question({ bonne_reponse: 1, explication: 'Deux textes se collent.' }),
      ma_reponse: { choix: 1, correcte: true, points: 875 },
      moi: { points: 1750, bonnes: 2, questions_closes: 2, rang: 2, participants: 21 },
    })
    await monter()

    expect(await screen.findByText('Juste : +875 points.')).toBeInTheDocument()
    expect(screen.getByText('Deux textes se collent.')).toBeInTheDocument()
    expect(screen.getByText(/2e sur 21/)).toBeInTheDocument()
    const juste = screen.getByText('22').closest('li')!
    expect(within(juste).getByText('Ta réponse')).toBeInTheDocument()
    expect(juste).toHaveAttribute('data-etat', 'bonne')
    // Plus de boutons : la question est close.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('à la correction, une réponse fausse est marquée comme la sienne', async () => {
    etat = etatEleve({
      phase: 'correction',
      question: question({ bonne_reponse: 1 }),
      ma_reponse: { choix: 0, correcte: false, points: 0 },
      moi: { points: 0, bonnes: 0, questions_closes: 1, rang: 3, participants: 3 },
    })
    await monter()
    expect(await screen.findByText('Pas cette fois.')).toBeInTheDocument()
    expect(screen.getByText('4').closest('li')).toHaveAttribute('data-mienne', 'true')
    expect(screen.getByText(/3e sur 3/)).toBeInTheDocument()
  })

  it('à la correction, sans réponse, le dit sans reproche', async () => {
    etat = etatEleve({ phase: 'correction', question: question({ bonne_reponse: 1 }) })
    await monter()
    expect(await screen.findByText('Pas de réponse à temps pour celle-ci.')).toBeInTheDocument()
  })

  it('en fin de partie, donne son bilan et rappelle que le score ne compte nulle part', async () => {
    etat = etatEleve({
      phase: 'terminee',
      moi: { points: 6420, bonnes: 8, questions_closes: 12, rang: 1, participants: 21 },
    })
    await monter()
    expect(await screen.findByText('8 bonnes réponses sur 12')).toBeInTheDocument()
    expect(screen.getByText(/1er sur 21/)).toBeInTheDocument()
    expect(screen.getByText(/ne compte ni dans ta progression/)).toBeInTheDocument()
  })

  it('en fin d une partie qu il n a pas jouée, le dit simplement', async () => {
    etat = etatEleve({ phase: 'terminee', rejoint: false, moi: null })
    await monter()
    expect(await screen.findByText("Tu n'as pas joué cette partie.")).toBeInTheDocument()
  })

  it('signale une plateforme muette, à la relecture suivante', async () => {
    etat = etatEleve()
    await monter()
    await screen.findByText(/Tu es dans la partie/)
    fetchFactice.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    // Sonnette muette : la relève passe chaque seconde.
    expect(await screen.findByRole('alert', {}, { timeout: 2_500 })).toHaveTextContent(
      /ne répond pas/,
    )
  })
})

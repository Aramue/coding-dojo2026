import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EtatProf } from '../../src/quiz/types'
import { QuizProf } from '../../src/ui/QuizProf'
import { etatProf, poserSonnetteMuette, question, reponse } from './quiz-outillage'

const INSCRITS = [
  { code_acces: 'DOJO-K7M2', prenom: 'Camille', nom: 'Rey' },
  { code_acces: 'DOJO-M3QP', prenom: 'Alex', nom: 'Morel' },
  { code_acces: 'DOJO-BZUH', prenom: 'Noa', nom: '' },
]
const CATALOGUE = [{ id: 'q1-bases', titre: 'Les bases de la séance 1', seance: 1, questions: 12, duree_s: 280 }]

let etat: EtatProf
let apresAction: ReturnType<typeof reponse>
let catalogue: unknown
let fetchFactice: ReturnType<typeof vi.fn>

function monter() {
  fetchFactice = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/prof/eleves') return reponse({ eleves: INSCRITS })
    if (url === '/api/prof/quiz') return reponse({ quiz: catalogue })
    if (url === '/api/prof/quiz/partie') return reponse(etat)
    if (options?.method === 'POST') {
      // Comme le serveur : une action acceptée change ce que la relecture rend.
      const action = apresAction as ReturnType<typeof reponse>
      const corps = await action.json()
      if (action.ok) etat = corps as typeof etat
      return reponse(corps, action.status)
    }
    throw new Error(`appel inattendu : ${url}`)
  })
  vi.stubGlobal('fetch', fetchFactice)
  render(<QuizProf codeProf="code-prof" />)
}

function postes() {
  return fetchFactice.mock.calls
    .filter(([, options]) => options?.method === 'POST')
    .map(([url, options]) => [url, options.body ?? null])
}

beforeEach(() => {
  poserSonnetteMuette()
  catalogue = CATALOGUE
  history.pushState(null, '', '/prof/quiz')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('QuizProf', () => {
  it('sans partie, propose le catalogue et lance un quiz', async () => {
    etat = { partie: null, maintenant: new Date().toISOString() }
    apresAction = reponse(etatProf(), 201)
    monter()

    expect(await screen.findByText('12 questions · environ 5 min de réponse')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Lancer' }))
    expect(postes()).toEqual([['/api/prof/quiz/parties', '{"quiz_id":"q1-bases"}']])
    expect(await screen.findByText("Salle d'attente")).toBeInTheDocument()
    expect(screen.getByText(/0 élève\s+sur 3 dans la partie/)).toBeInTheDocument()
  })

  it('dit comment ajouter un quiz quand le catalogue est vide', async () => {
    etat = { partie: null, maintenant: new Date().toISOString() }
    catalogue = []
    monter()
    expect(await screen.findByText(/Aucun quiz n'est construit/)).toBeInTheDocument()
  })

  it('en salle d attente, nomme qui est là et lance la première question', async () => {
    etat = etatProf({ participants: INSCRITS.slice(0, 2) })
    apresAction = reponse(etatProf({ phase: 'question', question: question() }))
    monter()

    const joueurs = await screen.findByRole('list', { name: 'Élèves dans la partie' })
    expect(within(joueurs).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Camille R.',
      'Alex M.',
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la première question' }))
    expect(postes()).toEqual([['/api/prof/quiz/partie/suivante', '{"question":-1}']])
    expect(await screen.findByRole('timer')).toBeInTheDocument()
  })

  it('pendant la question, ne projette ni la réponse ni la répartition', async () => {
    etat = etatProf({
      phase: 'question',
      question: question({ rang: 2 }),
      participants: INSCRITS,
      reponses_recues: 2,
    })
    apresAction = reponse(etatProf({ phase: 'correction', question: question({ rang: 2, bonne_reponse: 1 }) }))
    monter()

    expect(await screen.findByText('Question 3 sur 12')).toBeInTheDocument()
    expect(screen.getByText('2 réponses sur 3')).toBeInTheDocument()
    expect(screen.queryByText(/bonne réponse/)).toBeNull()
    expect(document.querySelector('.options-quiz__compte')).toBeNull()
    // L'écran projeté n'offre rien à cliquer dans les options.
    expect(screen.queryByRole('button', { name: /22/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Corriger maintenant' }))
    expect(postes()).toEqual([['/api/prof/quiz/partie/corriger', '{"question":2}']])
  })

  it('à la correction, projette la réponse, la répartition et les cinq premiers', async () => {
    etat = etatProf({
      phase: 'correction',
      question: question({ bonne_reponse: 1, explication: 'Deux textes se collent.' }),
      participants: INSCRITS,
      reponses_recues: 3,
      repartition: [2, 1, 0, 0],
      podium: [{ ...INSCRITS[1]!, points: 910, rang: 1 }],
    })
    apresAction = reponse(etatProf({ phase: 'question', question: question({ rang: 1 }) }))
    monter()

    expect(await screen.findByText('Question 1 sur 12 · correction')).toBeInTheDocument()
    expect(screen.getByText('22').closest('li')).toHaveAttribute('data-etat', 'bonne')
    expect(screen.getByText('Deux textes se collent.')).toBeInTheDocument()
    const podium = screen.getByRole('complementary', { name: 'En tête' })
    expect(podium).toHaveTextContent('Alex M.')
    expect(podium).toHaveTextContent('910')

    await userEvent.click(screen.getByRole('button', { name: 'Question suivante' }))
    expect(postes()).toEqual([['/api/prof/quiz/partie/suivante', '{"question":0}']])
  })

  it('après la dernière question, annonce le résultat final', async () => {
    etat = etatProf({ phase: 'correction', derniere: true, question: question({ rang: 11, bonne_reponse: 0 }) })
    monter()
    expect(await screen.findByRole('button', { name: 'Voir le résultat final' })).toBeInTheDocument()
  })

  it('en fin de partie, le podium et le bilan anonyme, question par question', async () => {
    etat = etatProf({
      phase: 'terminee',
      podium: [{ ...INSCRITS[0]!, points: 1800, rang: 1 }],
      bilan: [
        { rang: 0, enonce: 'Q facile', code: 'print(1)', options: ['1', '2'], bonne_reponse: 0, repartition: [3, 0], reponses: 3 },
        { rang: 1, enonce: 'Q piège', code: '', options: ['a', 'b', 'c'], bonne_reponse: 2, repartition: [2, 1, 0], reponses: 3 },
        { rang: 2, enonce: 'Q muette', code: '', options: ['x', 'y'], bonne_reponse: 1, repartition: [0, 0], reponses: 0 },
      ],
    })
    monter()

    expect(await screen.findByText('Partie terminée')).toBeInTheDocument()
    expect(screen.getByText('Camille R.')).toBeInTheDocument()
    const lignes = within(screen.getByRole('region', { name: 'Question par question' })).getAllByRole('listitem')
    const piege = lignes.find((li) => li.textContent?.includes('Q piège'))!
    expect(piege).toHaveTextContent('À reprendre')
    expect(piege).toHaveTextContent('0 % de bonnes réponses (0 sur 3)')
    const facile = lignes.find((li) => li.textContent?.includes('Q facile'))!
    expect(facile).not.toHaveTextContent('À reprendre')
    expect(lignes.find((li) => li.textContent?.includes('Q muette'))).toHaveTextContent('Aucune réponse')
    // Plus rien à arrêter.
    expect(screen.queryByRole('button', { name: 'Terminer la partie' })).toBeNull()
  })

  it('une partie où personne n a marqué ne projette aucun nom', async () => {
    etat = etatProf({ phase: 'terminee', bilan: [] })
    monter()
    expect(await screen.findByText(/Personne n'a marqué de point/)).toBeInTheDocument()
  })

  it('une nouvelle partie repasse par le catalogue, avec un retour possible', async () => {
    etat = etatProf({ phase: 'terminee', bilan: [] })
    monter()
    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle partie' }))
    expect(await screen.findByRole('heading', { name: 'Lancer un quiz' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Revenir à la dernière partie' }))
    expect(screen.getByText('Partie terminée')).toBeInTheDocument()
  })

  it('arrêter la partie demande une confirmation qui dit ce qu elle fait', async () => {
    etat = etatProf({ participants: INSCRITS })
    apresAction = reponse(etatProf({ phase: 'terminee', bilan: [] }))
    monter()

    await userEvent.click(await screen.findByRole('button', { name: 'Terminer la partie' }))
    expect(screen.getByText(/s'arrête pour tout le monde/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continuer la partie' }))
    expect(postes()).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'Terminer la partie' }))
    await userEvent.click(screen.getByRole('button', { name: 'Arrêter la partie' }))
    expect(postes()).toEqual([['/api/prof/quiz/partie/terminer', null]])
    expect(await screen.findByText('Partie terminée')).toBeInTheDocument()
  })

  it('montre le refus du serveur, écrit pour être lu', async () => {
    etat = etatProf()
    apresAction = reponse({ detail: 'La partie a déjà avancé.' }, 409)
    monter()
    await userEvent.click(await screen.findByRole('button', { name: 'Lancer la première question' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La partie a déjà avancé.')
  })

  it('ramène au tableau de bord', async () => {
    etat = etatProf()
    monter()
    await userEvent.click(await screen.findByRole('button', { name: 'Retour au tableau de bord' }))
    expect(location.pathname).toBe('/prof')
  })

  it('reste lisible sans la liste de la classe ni le catalogue', async () => {
    etat = { partie: null, maintenant: new Date().toISOString() }
    fetchFactice = vi.fn(async (url: string) => {
      if (url === '/api/prof/quiz/partie') return reponse(etat)
      return reponse({ detail: 'panne' }, 500)
    })
    vi.stubGlobal('fetch', fetchFactice)
    render(<QuizProf codeProf="code-prof" />)
    expect(await screen.findByText('panne')).toBeInTheDocument()
  })
})

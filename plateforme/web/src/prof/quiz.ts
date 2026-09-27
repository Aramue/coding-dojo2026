import { estPhotographie, messageRefus } from '../api/client'
import type { EtatProf, ResultatsQuiz, ResumeQuiz } from '../quiz/types'

/**
 * Le client des routes du quiz côté professeur. Toutes portent le code
 * professeur, comme la gestion de classe.
 *
 * Chaque action rappelle le rang de la question que l'écran croit courante :
 * un double clic sur « Question suivante » est refusé par le serveur au lieu
 * de sauter une question devant toute la classe.
 */

async function appeler(codeProf: string, chemin: string, options: RequestInit = {}): Promise<unknown> {
  let reponse: Response
  try {
    reponse = await fetch(`/api/prof/quiz${chemin}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Code-Prof': codeProf },
    })
  } catch {
    throw new Error('La plateforme ne répond pas.')
  }
  const donnees = await reponse.json().catch(() => null)
  if (reponse.status === 401) throw new Error('Code professeur refusé.')
  if (!reponse.ok) throw new Error(messageRefus(donnees, reponse.status))
  return donnees
}

async function etat(codeProf: string, chemin: string, options?: RequestInit): Promise<EtatProf> {
  const donnees = await appeler(codeProf, chemin, options)
  if (!estPhotographie(donnees)) throw new Error('Réponse inattendue de la plateforme.')
  return donnees as EtatProf
}

export async function listerQuiz(codeProf: string): Promise<ResumeQuiz[]> {
  const donnees = (await appeler(codeProf, '')) as { quiz?: unknown }
  if (!Array.isArray(donnees?.quiz)) throw new Error('Réponse inattendue de la plateforme.')
  return donnees.quiz as ResumeQuiz[]
}

/** Le bilan de la dernière partie jouée de ce quiz. */
export async function lireResultats(codeProf: string, quizId: string): Promise<ResultatsQuiz> {
  const donnees = (await appeler(codeProf, `/${quizId}/resultats`)) as ResultatsQuiz | null
  if (!Array.isArray(donnees?.bilan)) throw new Error('Réponse inattendue de la plateforme.')
  return donnees
}

export function lirePartie(codeProf: string): Promise<EtatProf> {
  return etat(codeProf, '/partie')
}

export function creerPartie(codeProf: string, quizId: string): Promise<EtatProf> {
  return etat(codeProf, '/parties', { method: 'POST', body: JSON.stringify({ quiz_id: quizId }) })
}

/** `question` : le rang affiché à l'écran au moment du clic, -1 en salle d'attente. */
export function questionSuivante(codeProf: string, question: number): Promise<EtatProf> {
  return etat(codeProf, '/partie/suivante', { method: 'POST', body: JSON.stringify({ question }) })
}

export function corriger(codeProf: string, question: number): Promise<EtatProf> {
  return etat(codeProf, '/partie/corriger', { method: 'POST', body: JSON.stringify({ question }) })
}

export function terminerPartie(codeProf: string): Promise<EtatProf> {
  return etat(codeProf, '/partie/terminer', { method: 'POST' })
}

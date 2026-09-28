import { estPhotographie, messageRefus } from '../api/client'
import type { EtatProf, ResultatsQuiz, ResumeQuiz } from '../quiz/types'

/**
 * Le client des routes du quiz côté professeur. Toutes portent le jeton de la
 * session professeur, comme la gestion de classe. Voir ADR-014.
 *
 * Chaque action rappelle le rang de la question que l'écran croit courante :
 * un double clic sur « Question suivante » est refusé par le serveur au lieu
 * de sauter une question devant toute la classe.
 */

/**
 * Le jeton a expiré (douze heures) ou le compte a été recréé : l'écran doit
 * rendre la main à la porte, pas afficher une erreur qu'on ne peut que subir.
 */
export class SessionProfRefusee extends Error {
  constructor() {
    super('Session professeur refusée ou expirée : reconnecte-toi.')
  }
}

async function appeler(jetonProf: string, chemin: string, options: RequestInit = {}): Promise<unknown> {
  let reponse: Response
  try {
    reponse = await fetch(`/api/prof/quiz${chemin}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Jeton-Prof': jetonProf },
    })
  } catch {
    throw new Error('La plateforme ne répond pas.')
  }
  const donnees = await reponse.json().catch(() => null)
  if (reponse.status === 401) throw new SessionProfRefusee()
  if (!reponse.ok) throw new Error(messageRefus(donnees, reponse.status))
  return donnees
}

async function etat(jetonProf: string, chemin: string, options?: RequestInit): Promise<EtatProf> {
  const donnees = await appeler(jetonProf, chemin, options)
  if (!estPhotographie(donnees)) throw new Error('Réponse inattendue de la plateforme.')
  return donnees as EtatProf
}

export async function listerQuiz(jetonProf: string): Promise<ResumeQuiz[]> {
  const donnees = (await appeler(jetonProf, '')) as { quiz?: unknown }
  if (!Array.isArray(donnees?.quiz)) throw new Error('Réponse inattendue de la plateforme.')
  return donnees.quiz as ResumeQuiz[]
}

/** Le bilan de la dernière partie jouée de ce quiz. */
export async function lireResultats(jetonProf: string, quizId: string): Promise<ResultatsQuiz> {
  const donnees = (await appeler(jetonProf, `/${quizId}/resultats`)) as ResultatsQuiz | null
  if (!Array.isArray(donnees?.bilan)) throw new Error('Réponse inattendue de la plateforme.')
  return donnees
}

export function lirePartie(jetonProf: string): Promise<EtatProf> {
  return etat(jetonProf, '/partie')
}

export function creerPartie(jetonProf: string, quizId: string): Promise<EtatProf> {
  return etat(jetonProf, '/parties', { method: 'POST', body: JSON.stringify({ quiz_id: quizId }) })
}

/** `question` : le rang affiché à l'écran au moment du clic, -1 en salle d'attente. */
export function questionSuivante(jetonProf: string, question: number): Promise<EtatProf> {
  return etat(jetonProf, '/partie/suivante', { method: 'POST', body: JSON.stringify({ question }) })
}

export function corriger(jetonProf: string, question: number): Promise<EtatProf> {
  return etat(jetonProf, '/partie/corriger', { method: 'POST', body: JSON.stringify({ question }) })
}

export function terminerPartie(jetonProf: string): Promise<EtatProf> {
  return etat(jetonProf, '/partie/terminer', { method: 'POST' })
}

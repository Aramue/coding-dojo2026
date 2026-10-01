/**
 * Le compte professeur : savoir s'il existe, le créer, s'y connecter.
 *
 * Le mot de passe ne part que d'ici, et une seule fois : tout le reste du
 * tableau de bord voyage avec le jeton rendu. Voir ADR-014.
 */

/** Doit rester égal à MIN_MOT_DE_PASSE côté API. C'est le serveur qui tranche. */
export const LONGUEUR_MIN = 12

export async function compteExiste(): Promise<boolean> {
  const reponse = await fetch('/api/prof/compte')
  if (!reponse.ok) throw new Error('La plateforme ne répond pas.')
  const donnees = (await reponse.json()) as { existe?: unknown }
  if (typeof donnees?.existe !== 'boolean') throw new Error('Réponse inattendue de la plateforme.')
  return donnees.existe
}

async function demanderJeton(chemin: 'compte' | 'connexion', motDePasse: string): Promise<string> {
  const reponse = await fetch(`/api/prof/${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mot_de_passe: motDePasse }),
  })
  if (reponse.status === 401) throw new Error('Mot de passe incorrect.')
  if (reponse.status === 404) {
    throw new Error("Aucun compte professeur n'existe. Recharge la page pour le créer.")
  }
  if (reponse.status === 409) {
    throw new Error('Un compte professeur existe déjà. Recharge la page pour te connecter.')
  }
  if (reponse.status === 422) {
    throw new Error(`Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères.`)
  }
  // 429 : nginx borne les deux routes du mot de passe. La limite se compte par
  // adresse IP, et la classe entière partage celle du professeur — elle peut
  // donc tomber sans que ce soit lui qui se soit trompé.
  if (reponse.status === 429) {
    throw new Error('Trop de tentatives. Attends une minute, puis réessaie.')
  }
  if (!reponse.ok) throw new Error(`La plateforme a refusé (erreur ${reponse.status}).`)
  const donnees = (await reponse.json()) as { jeton?: unknown }
  if (typeof donnees?.jeton !== 'string') throw new Error('Réponse inattendue de la plateforme.')
  return donnees.jeton
}

export function creerCompte(motDePasse: string): Promise<string> {
  return demanderJeton('compte', motDePasse)
}

export function seConnecter(motDePasse: string): Promise<string> {
  return demanderJeton('connexion', motDePasse)
}

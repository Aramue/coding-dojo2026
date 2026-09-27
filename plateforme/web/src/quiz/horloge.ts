/**
 * L'heure du quiz est celle du serveur. Fonctions pures.
 *
 * Chaque question porte une échéance absolue (`fin_a`), et c'est le serveur
 * qui juge si une réponse arrive à temps. La montre d'une machine de salle
 * peut avancer ou retarder d'une minute : décompter sur elle afficherait
 * « 12 s » à un élève dont le temps est déjà écoulé. On mesure donc l'écart
 * une fois par photographie, et on décompte sur l'heure du serveur.
 */

/** Doit rester égale à `TOLERANCE` dans `api/app/quiz.py`. */
export const TOLERANCE_MS = 500

/** Marge après la tolérance avant de relire : la correction doit être là. */
const MARGE_MS = 250

/**
 * Écart entre l'horloge du serveur et celle de la machine, en millisecondes
 * (positif si le serveur est en avance).
 *
 * `envoiA` et `recuA` encadrent la requête : le serveur a lu son heure
 * quelque part entre les deux, on prend le milieu.
 */
export function ecart(maintenantServeur: string, envoiA: number, recuA: number): number {
  const serveur = Date.parse(maintenantServeur)
  if (Number.isNaN(serveur)) return 0
  return serveur - (envoiA + recuA) / 2
}

/** Millisecondes restantes avant l'échéance, jamais négatives. */
export function restant(finA: string, ecartMs: number, maintenantLocal: number): number {
  return Math.max(0, Date.parse(finA) - (maintenantLocal + ecartMs))
}

/** Les secondes qu'on affiche : 0,2 s restante se lit « 1 », pas « 0 ». */
export function secondesAffichees(ms: number): number {
  return Math.ceil(ms / 1000)
}

/**
 * L'instant, en heure de la machine, où relire pour trouver la correction.
 *
 * La correction ne s'écrit pas côté serveur : elle se déduit de l'échéance
 * plus la tolérance. Personne ne sonne à ce moment-là — c'est donc à chaque
 * écran de relire de lui-même.
 */
export function relectureA(finA: string, ecartMs: number): number {
  return Date.parse(finA) + TOLERANCE_MS + MARGE_MS - ecartMs
}

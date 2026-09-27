import { useEffect, useState } from 'react'
import { restant, secondesAffichees } from '../quiz/horloge'

/** Assez fin pour que la barre glisse, assez rare pour ne rien coûter. */
const PAS_MS = 250

/**
 * Le compte à rebours d'une question, sur l'heure du SERVEUR.
 *
 * Le seul mouvement de l'application qui dure plus de 400 ms : c'est une
 * horloge, le temps qui passe est l'information. La barre se vide par
 * `transform: scaleX()`, recalée à chaque quart de seconde ; sans mouvement
 * demandé, seules les secondes restent. Voir la Charte visuelle.
 */
export function CompteARebours({
  finA,
  ecartMs,
  dureeS,
}: {
  finA: string
  ecartMs: number
  dureeS: number
}) {
  const [maintenant, setMaintenant] = useState(() => Date.now())

  useEffect(() => {
    const minuteur = setInterval(() => setMaintenant(Date.now()), PAS_MS)
    return () => clearInterval(minuteur)
  }, [])

  const reste = restant(finA, ecartMs, maintenant)
  const secondes = secondesAffichees(reste)
  const part = Math.min(1, reste / (dureeS * 1000))

  return (
    <div
      className="compte"
      role="timer"
      aria-label={secondes > 0 ? `${secondes} secondes restantes` : 'Temps écoulé'}
    >
      <span className="compte__secondes" aria-hidden="true">
        {secondes}
      </span>
      <span className="compte__barre" aria-hidden="true">
        <span style={{ transform: `scaleX(${part})` }} />
      </span>
    </div>
  )
}

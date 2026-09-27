import { useEffect, useState } from 'react'
import type { ClientApi } from '../api/client'
import type { EtatEleve } from '../quiz/types'
import { naviguer } from '../routage'

/**
 * Une relecture toutes les dix secondes, comme le tableau de bord : le
 * bandeau n'a pas besoin de la sonnette, il suffit qu'il apparaisse avant
 * que le professeur ait fini de dire « allez sur le quiz ».
 */
export const PERIODE_BANDEAU_MS = 10_000

/**
 * Le bandeau qui invite l'élève dans une partie en cours.
 *
 * C'est la porte d'entrée du quiz : pas de code de partie à recopier, l'élève
 * est déjà connecté et une instance ne sert qu'une classe. Voir ADR-013.
 */
export function BandeauQuiz({ client, masque }: { client: ClientApi; masque: boolean }) {
  const [etat, setEtat] = useState<EtatEleve | null>(null)

  useEffect(() => {
    if (masque) return
    let vivant = true
    async function lire() {
      try {
        const nouvel = await client.lireQuiz()
        if (vivant) setEtat(nouvel)
      } catch {
        // Silencieux : un bandeau absent n'empêche personne de travailler, et
        // l'alerte de l'application signale déjà une plateforme muette.
        if (vivant) setEtat(null)
      }
    }
    void lire()
    const minuteur = setInterval(lire, PERIODE_BANDEAU_MS)
    return () => {
      vivant = false
      clearInterval(minuteur)
    }
  }, [client, masque])

  if (masque || !etat || etat.partie === null || etat.phase === 'terminee') return null

  return (
    <div className="bandeau-quiz" role="status">
      <span className="bandeau-quiz__texte">
        <b>{etat.rejoint ? 'Ta partie de quiz continue' : 'Un quiz a commencé'}</b>
        <span> · {etat.titre}</span>
      </span>
      <button
        type="button"
        className="bouton bouton--primaire"
        onClick={() => naviguer({ vue: 'quiz' })}
      >
        {etat.rejoint ? 'Revenir au quiz' : 'Rejoindre'}
      </button>
    </div>
  )
}

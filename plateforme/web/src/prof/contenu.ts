import { useEffect, useState } from 'react'
import {
  chargerChapitres,
  chargerLecons,
  chargerNotions,
  chargerParcours,
} from '../contenu/chargeur'
import type { Chapitre, Exercice, Lecon, Notion } from '../contenu/types'

export type ContenuPublie = {
  chapitres: Chapitre[]
  notions: Notion[]
  exercices: Exercice[]
  lecons: Lecon[]
}

/**
 * Le contenu publié, tel que l'élève le reçoit.
 *
 * Les écrans du professeur en ont besoin pour deux choses : lire des titres au
 * lieu d'identifiants, et rejouer à l'identique ce que l'élève a sous les yeux.
 * Il est statique — chargé une fois, jamais rafraîchi avec la séance.
 *
 * Rend `null` tant qu'il n'est pas là, et **reste** à `null` s'il ne vient pas :
 * sans contenu le tableau de bord est dégradé, jamais cassé. Il ne doit surtout
 * pas disparaître pour autant.
 */
export function useContenuPublie(): ContenuPublie | null {
  const [contenu, setContenu] = useState<ContenuPublie | null>(null)

  useEffect(() => {
    let vivant = true
    Promise.all([chargerChapitres(), chargerNotions(), chargerParcours(), chargerLecons()])
      .then(([chapitres, notions, exercices, lecons]) => {
        // Même garde que sur la séance : un non-tableau dans l'état ferait
        // planter le premier `.map` du rendu, et l'écran du professeur
        // ==deviendrait blanc en pleine séance==.
        if (![chapitres, notions, exercices, lecons].every(Array.isArray)) return
        if (vivant) setContenu({ chapitres, notions, exercices, lecons })
      })
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [])

  return contenu
}

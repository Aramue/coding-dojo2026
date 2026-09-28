import { useEffect, useState } from 'react'
import { chargerContenu } from '../contenu/chargeur'
import type { ContenuPublie } from '../contenu/types'

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
    chargerContenu()
      .then((publie) => {
        if (vivant) setContenu(publie)
      })
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [])

  return contenu
}

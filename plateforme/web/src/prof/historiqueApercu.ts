import { useCallback, useEffect, useState } from 'react'
import type { Destination } from '../routage'

/**
 * L'aperçu du professeur, rangé dans l'historique du navigateur.
 *
 * L'aperçu s'ouvre par-dessus le tableau de bord sans changer d'adresse : on
 * reste sur `/prof`. Tant que ses pages ne vivaient que dans l'état de React,
 * ==le bouton Retour ne les connaissait pas== — après quatre exercices
 * parcourus, il ne revenait pas au troisième : il faisait quitter le tableau de
 * bord, pour la page vue avant d'y entrer.
 *
 * Chaque page de l'aperçu est donc une entrée d'historique, sur la même
 * adresse, qui porte dans son `state` où l'on est. Retour revient à la page
 * d'avant, là où on l'avait laissée ; Retour sur la première referme l'aperçu ;
 * Suivant le rouvre.
 */
export type EtatApercu = {
  /** Absent : « ouvre où tu veux », la première leçon ou la première liste. */
  ou?: Destination
  /** Entré par « Solutions des exercices » : solutions dépliées. */
  solutions: boolean
  /**
   * Le nombre d'entrées empilées depuis le tableau de bord, celle-ci comprise.
   * C'est ce qui permet à « Fermer l'aperçu » de revenir d'un coup au tableau,
   * sans laisser derrière lui des pages d'aperçu que Retour rouvrirait.
   */
  profondeur: number
  /** Où en était le défilement quand on a quitté cette page. */
  defilement: number
}

function lire(): EtatApercu | null {
  const etat = (history.state as { apercu?: Partial<EtatApercu> } | null)?.apercu
  if (!etat || typeof etat.profondeur !== 'number' || etat.profondeur < 1) return null
  return {
    ou: etat.ou,
    solutions: etat.solutions === true,
    profondeur: etat.profondeur,
    defilement: typeof etat.defilement === 'number' ? etat.defilement : 0,
  }
}

export function useHistoriqueApercu() {
  // Lu au montage : un rechargement de la page rouvre l'aperçu où il était.
  const [apercu, setApercu] = useState<EtatApercu | null>(lire)

  // Retour, Suivant, et toute navigation de l'application : on relit où l'on est.
  useEffect(() => {
    const relire = () => setApercu(lire())
    addEventListener('popstate', relire)
    return () => removeEventListener('popstate', relire)
  }, [])

  const ouvrir = useCallback((ou?: Destination, solutions = false) => {
    const etat: EtatApercu = { ou, solutions, profondeur: 1, defilement: 0 }
    history.pushState({ apercu: etat }, '')
    setApercu(etat)
  }, [])

  /** Un clic dans l'aperçu : la page quittée garde son défilement, la suivante s'empile. */
  const aller = useCallback((ou: Destination, defilementQuitte: number) => {
    const courant = lire()
    if (!courant) return
    history.replaceState({ apercu: { ...courant, defilement: defilementQuitte } }, '')
    const suivant: EtatApercu = { ...courant, ou, profondeur: courant.profondeur + 1, defilement: 0 }
    history.pushState({ apercu: suivant }, '')
    setApercu(suivant)
  }, [])

  /**
   * Revient d'un coup au tableau de bord. `history.go` est asynchrone : c'est
   * le `popstate` qu'il déclenche qui referme, par `relire`.
   */
  const fermer = useCallback(() => {
    const courant = lire()
    if (courant) history.go(-courant.profondeur)
    else setApercu(null)
  }, [])

  return { apercu, ouvrir, aller, fermer }
}

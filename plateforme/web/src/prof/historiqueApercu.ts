import { useCallback, useEffect, useRef, useState } from 'react'
import { analyser, versChemin, type Destination } from '../routage'

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

/**
 * Une destination relue de l'historique n'est pas crue sur parole : elle a pu
 * être écrite par une version précédente de l'application, restée dans un
 * onglet ouvert pendant un déploiement. On la fait repasser par le routeur —
 * seul juge de ce qu'est une page —, et tout ce qu'il ne reconnaît pas devient
 * « ouvre où tu veux ». Sans cela, un `ou` mal formé plantait le rendu de
 * l'aperçu, et l'écran du professeur devenait blanc.
 */
function destinationSure(brut: unknown): Destination | undefined {
  if (typeof brut !== 'object' || brut === null) return undefined
  const relue = analyser(versChemin(brut as Destination))
  return relue.vue === 'cours' || relue.vue === 'exercices' || relue.vue === 'exercice'
    ? relue
    : undefined
}

function lire(): EtatApercu | null {
  const etat = (history.state as { apercu?: Record<string, unknown> } | null)?.apercu
  if (typeof etat !== 'object' || etat === null) return null
  const { profondeur, defilement } = etat
  if (typeof profondeur !== 'number' || !Number.isInteger(profondeur) || profondeur < 1) return null
  return {
    ou: destinationSure(etat.ou),
    solutions: etat.solutions === true,
    profondeur,
    defilement: typeof defilement === 'number' && defilement >= 0 ? defilement : 0,
  }
}

/** Un recul dans la même page est quasi immédiat : au-delà, c'est qu'il n'a pas eu lieu. */
const DELAI_SANS_RECUL_MS = 500

export function useHistoriqueApercu() {
  // Lu au montage : un rechargement de la page rouvre l'aperçu où il était.
  const [apercu, setApercu] = useState<EtatApercu | null>(lire)

  // Vrai entre « Fermer » et le `popstate` qui lui répond : voir `fermer`.
  const fermeture = useRef(false)

  // Retour, Suivant, et toute navigation de l'application : on relit où l'on est.
  useEffect(() => {
    const relire = () => {
      fermeture.current = false
      setApercu(lire())
    }
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
   *
   * > [!danger] Un seul recul par fermeture
   * > Tant que ce `popstate` n'est pas arrivé, `history.state` est encore celui
   * > de l'aperçu. Un second « Fermer » — Échap pressé deux fois, ou Échap puis
   * > le bouton — relirait la même profondeur et reculerait une seconde fois :
   * > ==le professeur quitterait le tableau de bord==. D'où le verrou.
   */
  const fermer = useCallback(() => {
    if (fermeture.current) return
    const courant = lire()
    if (!courant) {
      setApercu(null)
      return
    }
    fermeture.current = true
    history.go(-courant.profondeur)
    // Si l'historique est plus court que la profondeur annoncée — un onglet
    // dupliqué n'emporte pas toujours le sien —, `go` ne fait rien et aucun
    // `popstate` ne viendra. On referme alors sur place, sans laisser l'état.
    setTimeout(() => {
      if (!fermeture.current) return
      fermeture.current = false
      history.replaceState(null, '')
      setApercu(null)
    }, DELAI_SANS_RECUL_MS)
  }, [])

  return { apercu, ouvrir, aller, fermer }
}

import { createContext, useContext } from 'react'

/**
 * Ce qui défile réellement autour du contenu.
 *
 * `null` — le cas de l'élève : c'est la fenêtre. Un élément — le cas de
 * l'aperçu du professeur : c'est le cadre, et la page, elle, ne bouge pas.
 *
 * Sans cette distinction, tout composant qui lit `scrollY` mesure un
 * défilement qui n'a pas lieu, et se croit soit au début, soit à la fin.
 */
export const ContexteDefilement = createContext<HTMLElement | null>(null)

export function useDefilement(): HTMLElement | null {
  return useContext(ContexteDefilement)
}

/** Où en est la lecture, entre 0 et 1, sur la fenêtre ou sur un cadre. */
export function partLue(conteneur: HTMLElement | null): number {
  const parcouru = conteneur ? conteneur.scrollTop : scrollY
  const parcourable = conteneur
    ? conteneur.scrollHeight - conteneur.clientHeight
    : document.documentElement.scrollHeight - innerHeight

  // Un contenu plus court que sa fenêtre est lu en entier d'emblée : sans ce
  // cas, on divise par zéro et la barre part à NaN.
  if (parcourable <= 0) return 1
  return Math.min(1, Math.max(0, parcouru / parcourable))
}

import { useEffect, useState } from 'react'

/**
 * Les solutions de référence, pour le professeur seulement.
 *
 * Le contenu publié — celui que l'élève télécharge — n'en porte aucune : tout
 * ce qui arrive dans son navigateur, il peut le lire. Elles viennent donc de
 * l'API, derrière le jeton professeur, et ne vivent que dans la mémoire de cet
 * onglet. ==Ne jamais les ranger dans `sessionStorage` ni ailleurs== : la
 * machine de la salle sert aussi aux élèves.
 */
export type Solutions = Record<string, string>

export async function lireSolutions(jetonProf: string): Promise<Solutions> {
  const reponse = await fetch('/api/prof/solutions', { headers: { 'X-Jeton-Prof': jetonProf } })
  if (!reponse.ok) throw new Error(`Solutions indisponibles (erreur ${reponse.status}).`)
  const donnees = (await reponse.json()) as { solutions?: unknown }
  const solutions = donnees?.solutions
  // Même garde que sur la séance : une forme inattendue ne doit pas atteindre
  // le rendu, où un `.trimEnd()` sur un nombre ferait un écran blanc.
  if (
    typeof solutions !== 'object' ||
    solutions === null ||
    Array.isArray(solutions) ||
    !Object.values(solutions).every((valeur) => typeof valeur === 'string')
  ) {
    throw new Error('Réponse inattendue de la plateforme.')
  }
  return solutions as Solutions
}

/**
 * Rend `null` tant qu'elles ne sont pas là, et **reste** à `null` si elles ne
 * viennent pas : sans solutions l'aperçu est le même qu'avant, jamais cassé.
 */
export function useSolutions(jetonProf: string): Solutions | null {
  const [solutions, setSolutions] = useState<Solutions | null>(null)

  useEffect(() => {
    let vivant = true
    lireSolutions(jetonProf)
      .then((lues) => {
        if (vivant) setSolutions(lues)
      })
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [jetonProf])

  return solutions
}

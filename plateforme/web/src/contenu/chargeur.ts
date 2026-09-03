import type { Exercice } from './types'

/** Variables à relire dans l'espace de noms après exécution, pour les tests `variable`. */
export function nomsVariablesRequis(exercice: Exercice): string[] {
  const noms = new Set<string>()
  for (const test of exercice.tests) if (test.type === 'variable') noms.add(test.nom)
  return [...noms].sort()
}

/** Les exercices sont construits dans l'image et servis en statique. */
export async function chargerParcours(chemin = '/contenu/seance-1.json'): Promise<Exercice[]> {
  const reponse = await fetch(chemin)
  if (!reponse.ok) throw new Error(`Contenu introuvable (${reponse.status})`)
  return (await reponse.json()) as Exercice[]
}

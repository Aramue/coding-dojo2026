import type { Chapitre, Exercice, Lecon, Notion } from './types'

/** Variables à relire dans l'espace de noms après exécution, pour les tests `variable`. */
export function nomsVariablesRequis(exercice: Exercice): string[] {
  const noms = new Set<string>()
  for (const test of exercice.tests) if (test.type === 'variable') noms.add(test.nom)
  return [...noms].sort()
}

/** Le contenu est construit dans l'image et servi en statique. */
export async function chargerJson<T>(chemin: string): Promise<T> {
  const reponse = await fetch(chemin)
  if (!reponse.ok) throw new Error(`Contenu introuvable (${reponse.status})`)
  return (await reponse.json()) as T
}

export const chargerParcours = (chemin = '/contenu/seance-1.json') =>
  chargerJson<Exercice[]>(chemin)

export const chargerNotions = (chemin = '/contenu/seance-1-notions.json') =>
  chargerJson<Notion[]>(chemin)

export const chargerLecons = (chemin = '/contenu/seance-1-lecons.json') =>
  chargerJson<Lecon[]>(chemin)

export const chargerChapitres = (chemin = '/contenu/seance-1-chapitres.json') =>
  chargerJson<Chapitre[]>(chemin)

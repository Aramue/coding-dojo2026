import type { Chapitre, ContenuPublie, Exercice, Lecon, Notion } from './types'

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

/**
 * Tout le contenu publié : quatre fichiers, toutes séances confondues.
 *
 * Un fichier qui n'est pas un tableau est refusé ici, à l'entrée. Glissé dans
 * l'état, il ferait planter le premier `.map` du rendu, et ==l'écran
 * deviendrait blanc en pleine séance== sans rien qui explique pourquoi.
 */
export async function chargerContenu(): Promise<ContenuPublie> {
  const [chapitres, notions, exercices, lecons] = await Promise.all([
    chargerJson<Chapitre[]>('/contenu/chapitres.json'),
    chargerJson<Notion[]>('/contenu/notions.json'),
    chargerJson<Exercice[]>('/contenu/exercices.json'),
    chargerJson<Lecon[]>('/contenu/lecons.json'),
  ])
  if (![chapitres, notions, exercices, lecons].every(Array.isArray)) {
    throw new Error('Contenu illisible.')
  }
  return { chapitres, notions, exercices, lecons }
}

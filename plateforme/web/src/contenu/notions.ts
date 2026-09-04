import type { Chapitre, Exercice, Lecon, Notion } from './types'

export type GroupeNotion = Notion & {
  exercices: Exercice[]
  lecon: Lecon | null
  faits: number
}

/**
 * Assemble la vue dont le menu et les pages ont besoin : une notion, sa leçon,
 * ses exercices dans l'ordre du fichier, et le compte de ceux déjà réussis.
 *
 * Fonction pure, sans état ni requête : toute la logique de navigation vit ici
 * et se teste sans DOM ni serveur.
 */
export function grouper(
  notions: Notion[],
  exercices: Exercice[],
  lecons: Lecon[],
  reussis: string[],
): GroupeNotion[] {
  const acquis = new Set(reussis)
  // Copie avant tri : `sort` modifie le tableau en place, et celui-ci vient
  // de l'état React de l'appelant.
  return [...notions]
    .sort((a, b) => a.ordre - b.ordre)
    .map((notion) => {
      const siens = exercices.filter((e) => e.notion === notion.id)
      return {
        ...notion,
        exercices: siens,
        lecon: lecons.find((l) => l.notion === notion.id) ?? null,
        faits: siens.filter((e) => acquis.has(e.id)).length,
      }
    })
}

/** Là où `/` envoie l'élève : la première notion qu'il n'a pas terminée. */
export function premiereOuverte(groupes: GroupeNotion[]): GroupeNotion | null {
  return groupes.find((g) => g.faits < g.exercices.length) ?? groupes[0] ?? null
}

export type GroupeChapitre = Chapitre & {
  notions: GroupeNotion[]
  /** Exercices réussis et total, cumulés sur les notions du chapitre. */
  faits: number
  total: number
}

/**
 * Le niveau au-dessus : ce que le menu déplie. Une notion dont le chapitre
 * n'existe pas est ignorée, comme un exercice dont la notion n'existe pas —
 * le contenu publié reste la seule autorité.
 */
export function grouperParChapitre(
  chapitres: Chapitre[],
  groupes: GroupeNotion[],
): GroupeChapitre[] {
  return [...chapitres]
    .sort((a, b) => a.ordre - b.ordre)
    .map((chapitre) => {
      const siennes = groupes.filter((g) => g.chapitre === chapitre.id)
      return {
        ...chapitre,
        notions: siennes,
        faits: siennes.reduce((n, g) => n + g.faits, 0),
        total: siennes.reduce((n, g) => n + g.exercices.length, 0),
      }
    })
}

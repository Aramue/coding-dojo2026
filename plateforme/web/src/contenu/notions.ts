import type { Reussite } from '../validation/types'
import type { Chapitre, Exercice, Lecon, Notion } from './types'

export type GroupeNotion = Notion & {
  /** Tous les exercices de la notion, obligatoires et bonus, dans l'ordre publié. */
  exercices: Exercice[]
  lecon: Lecon | null
  /** Réussis parmi les OBLIGATOIRES. Un bonus ne compte jamais. */
  faits: number
  /** Nombre d'obligatoires — le dénominateur affiché. */
  total: number
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
  reussis: Reussite[],
): GroupeNotion[] {
  const acquis = new Set(reussis.map((r) => r.exerciceId))
  // Copie avant tri : `sort` modifie le tableau en place, et celui-ci vient
  // de l'état React de l'appelant.
  return [...notions]
    .sort((a, b) => a.ordre - b.ordre)
    .map((notion) => {
      const siens = exercices.filter((e) => e.notion === notion.id)
      // Le chemin minimal, c'est l'obligatoire. Compter les bonus dans le
      // denominateur ferait paraitre le parcours plus long qu'il ne l'est, et
      // un eleve qui a tout fait ne verrait jamais son compteur au maximum.
      // Voir ADR-004 : un expert n'est jamais compte dans la progression.
      const obligatoires = siens.filter((e) => e.obligatoire)
      return {
        ...notion,
        exercices: siens,
        lecon: lecons.find((l) => l.notion === notion.id) ?? null,
        faits: obligatoires.filter((e) => acquis.has(e.id)).length,
        total: obligatoires.length,
      }
    })
}

/** Là où `/` envoie l'élève : la première notion qu'il n'a pas terminée. */
export function premiereOuverte(groupes: GroupeNotion[]): GroupeNotion | null {
  return groupes.find((g) => g.faits < g.total) ?? groupes[0] ?? null
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
        total: siennes.reduce((n, g) => n + g.total, 0),
      }
    })
}

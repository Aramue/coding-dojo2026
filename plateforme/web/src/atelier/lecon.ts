import type { Bloc, Lecon, Notion } from '../contenu/types'

/**
 * Une leçon en cours d'écriture.
 *
 * Même forme que le fichier YAML : `famille` n'y est pas, elle se déduit de la
 * notion à la construction. `ordre` non plus — c'est celui de la notion, et le
 * schéma refuse le désaccord depuis le 14 septembre 2026.
 */
export type BrouillonLecon = {
  id: string
  notion: string
  titre: string
  dureeMin: number
  blocs: Bloc[]
}

export const LECON_VIDE: BrouillonLecon = {
  id: '',
  notion: '',
  titre: '',
  dureeMin: 3,
  blocs: [],
}

/** Les champs sans lesquels le fichier serait refusé par le schéma. */
export function champsManquantsLecon(brouillon: BrouillonLecon): string[] {
  const manquants: string[] = []
  if (!/^c([1-9][0-9]?)-[a-z]+$/.test(brouillon.id)) manquants.push('un identifiant bien formé')
  if (!brouillon.notion) manquants.push('une notion')
  if (!brouillon.titre.trim()) manquants.push('un titre')
  if (brouillon.blocs.length === 0) manquants.push('au moins un bloc')
  return manquants
}

/**
 * La leçon vue comme une leçon publiée, pour l'aperçu.
 *
 * `ordre` et `famille` viennent de la notion, exactement comme le fait
 * `construire_contenu.py` : l'ordre décide quelles notions les exemples ont le
 * droit d'employer, et la famille donne sa couleur à la page.
 */
export function versLecon(brouillon: BrouillonLecon, notions: Notion[]): Lecon {
  const notion = notions.find((n) => n.id === brouillon.notion)
  return {
    ...brouillon,
    ordre: notion?.ordre ?? 1,
    famille: notion?.famille ?? 'variables',
  }
}

/** Un bloc neuf de la sorte demandée, avec ses champs à vide. */
export function blocNeuf(sorte: Bloc['type']): Bloc {
  if (sorte === 'code') {
    return { type: 'code', legende: '', python: '', executable: false, entrees: [] }
  }
  return { type: sorte, texte: '' }
}

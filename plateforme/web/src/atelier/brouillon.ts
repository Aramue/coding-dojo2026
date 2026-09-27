import type { Exercice, Notion } from '../contenu/types'
import type { Test } from '../validation/types'

/**
 * Un exercice en cours d'écriture.
 *
 * C'est la forme du fichier YAML, pas celle du contenu publié : `famille` n'y
 * est pas — elle se déduit de la notion à la construction — et `seance` est un
 * nombre libre, que l'identifiant fixe.
 */
export type Brouillon = {
  id: string
  concept: string
  notion: string
  seance: number
  niveau: 'normal' | 'expert'
  type: 'predire' | 'debug' | 'completer' | 'ecrire'
  titre: string
  obligatoire: boolean
  enonce: string
  depart: string
  indices: string[]
  tests: Test[]
  solution: string
  expert?: string
}

export const BROUILLON_VIDE: Brouillon = {
  id: '',
  concept: '',
  notion: '',
  seance: 1,
  niveau: 'normal',
  type: 'ecrire',
  titre: '',
  obligatoire: true,
  enonce: '',
  depart: '',
  indices: [],
  tests: [],
  solution: '',
}

/**
 * La séance que déclare un identifiant : `s4-12` annonce la quatrième.
 *
 * Elle ne se saisit pas. Les deux se sont suivis à la main sur 112 fichiers, et
 * un exercice rangé dans la mauvaise séance n'échoue nulle part — il apparaît
 * le mauvais jour. Le schéma refuse désormais le désaccord ; autant ne jamais
 * le produire.
 */
export function seanceDeLIdentifiant(id: string): number | null {
  const trouve = /^s([1-9][0-9]?)-[0-9]{2}(-expert)?$/.exec(id)
  return trouve ? Number(trouve[1]) : null
}

/** Les champs sans lesquels le fichier serait refusé par le schéma. */
export function champsManquants(brouillon: Brouillon): string[] {
  const manquants: string[] = []
  if (seanceDeLIdentifiant(brouillon.id) === null) manquants.push('un identifiant bien formé')
  if (!brouillon.notion) manquants.push('une notion')
  if (!brouillon.concept.trim()) manquants.push('un concept')
  if (!brouillon.titre.trim()) manquants.push('un titre')
  if (!brouillon.enonce.trim()) manquants.push('un énoncé')
  if (!brouillon.solution.trim()) manquants.push('une solution')
  if (brouillon.tests.length === 0) manquants.push('au moins un test')
  return manquants
}

/**
 * Le brouillon vu comme un exercice publié, pour l'aperçu.
 *
 * `famille` vient de la notion, exactement comme le fait `construire_contenu.py`
 * au moment de publier : sans elle, l'écran de l'élève n'a pas de couleur.
 */
export function versExercice(brouillon: Brouillon, notions: Notion[]): Exercice {
  const notion = notions.find((n) => n.id === brouillon.notion)
  return {
    ...brouillon,
    // `variables` par défaut : une notion pas encore choisie ne doit pas faire
    // disparaître l'aperçu, elle doit juste le laisser sans sa vraie couleur.
    famille: notion?.famille ?? 'variables',
  }
}

import type { Test } from '../validation/types'

export type Exercice = {
  id: string
  /** Libre côté schéma Python : sert au regroupement fin, pas au typage. */
  concept: string
  /** L'unité de navigation : une leçon, un groupe d'exercices, une couleur. */
  notion: string
  famille: 'variables' | 'types' | 'operateurs' | 'conditions' | 'boucles'
  seance: 1 | 2 | 3
  niveau: 'normal' | 'expert'
  type: 'predire' | 'debug' | 'completer' | 'ecrire'
  titre: string
  obligatoire: boolean
  enonce: string
  depart: string
  indices: string[]
  tests: Test[]
  expert?: string
}

/**
 * Un chapitre regroupe les notions d'un même sujet. C'est le niveau qui
 * structure le menu : sans lui, les notions flottaient côte à côte sans dire
 * de quoi elles parlaient ensemble.
 */
export type Chapitre = {
  id: string
  ordre: number
  titre: string
  seance: number
  /**
   * Le jour où le chapitre s'ouvre aux élèves, `AAAA-MM-JJ`. Absent : ouvert
   * d'emblée — c'est le cas du premier, que le professeur doit pouvoir
   * parcourir avant le premier cours. Voir ADR-013.
   */
  ouverture?: string
}

/** Une notion du cours. Publiée par construire_contenu.py, jamais recopiée ici. */
export type Notion = {
  id: string
  ordre: number
  titre: string
  famille: Exercice['famille']
  chapitre: string
}

export type Bloc =
  | { type: 'paragraphe'; texte: string }
  | { type: 'attention'; texte: string }
  | {
      type: 'code'
      legende: string
      python: string
      executable: boolean
      /** Entrées simulées d'un exemple qui appelle `input()`. Jamais exécutable. */
      entrees: string[]
    }

export type Lecon = {
  id: string
  notion: string
  ordre: number
  titre: string
  dureeMin: number
  famille: Exercice['famille']
  blocs: Bloc[]
}

/** Tout ce que la construction publie, toutes séances confondues. */
export type ContenuPublie = {
  chapitres: Chapitre[]
  notions: Notion[]
  exercices: Exercice[]
  lecons: Lecon[]
}

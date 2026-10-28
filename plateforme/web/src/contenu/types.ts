import type { Test } from '../validation/types'

export type Exercice = {
  id: string
  /** Libre côté schéma Python : sert au regroupement fin, pas au typage. */
  concept: string
  /** L'unité de navigation : une leçon, un groupe d'exercices, une couleur. */
  notion: string
  /** Le concept enseigné, donc la couleur. `rappels` est neutre. Voir « Palette ». */
  famille: 'variables' | 'types' | 'operateurs' | 'conditions' | 'boucles' | 'rappels'
  seance: 1 | 2 | 3 | 4
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

/**
 * Un bloc de consignes de TP : ceux d'une leçon, plus deux qui guident.
 * `indice` se replie, l'élève l'ouvre quand il bloque ; `verifier` dit ce
 * qu'il doit voir à l'écran avant de passer à l'étape suivante.
 */
export type BlocTp =
  | Bloc
  | { type: 'indice'; texte: string }
  | { type: 'verifier'; texte: string }
  /** Un schéma dessiné par `SchemaTp`, choisi par son nom. */
  | { type: 'schema'; nom: 'pixels' | 'binaire' | 'masque' | 'octet' | 'ligne'; legende: string }

export type EtapeTp = {
  titre: string
  /** Une phrase : ce que l'étape fait obtenir. */
  objectif: string
  blocs: BlocTp[]
}

/**
 * Les consignes d'un travail pratique. Le TP se fait HORS de la plateforme,
 * dans un vrai Python : rien n'y est validé ni enregistré sur le serveur.
 */
export type Tp = {
  id: string
  chapitre: string
  titre: string
  dureeMin: number
  introduction: BlocTp[]
  materiel: string[]
  etapes: EtapeTp[]
}

/** Tout ce que la construction publie, toutes séances confondues. */
export type ContenuPublie = {
  chapitres: Chapitre[]
  notions: Notion[]
  exercices: Exercice[]
  lecons: Lecon[]
  tps: Tp[]
}

import type { Test } from '../validation/types'

export type Exercice = {
  id: string
  /** Libre côté schéma Python : sert au regroupement, pas au typage. */
  concept: string
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

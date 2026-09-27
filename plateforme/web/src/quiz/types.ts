/**
 * Les photographies du quiz, telles que l'API les rend.
 *
 * En snake_case, comme `LigneEleve` : ce sont des réponses d'API, lues telles
 * quelles. La règle du jeu vit côté serveur (`api/app/quiz.py`) ; ces types ne
 * font que décrire ce que chacun a le droit de voir.
 */

export type PhaseQuiz = 'attente' | 'question' | 'correction' | 'terminee'

export type QuestionVue = {
  rang: number
  total: number
  enonce: string
  code: string
  options: string[]
  duree_s: number
  ouverte_le: string
  fin_a: string
  /** Absente tant que la question n'est pas corrigée : le serveur ne l'envoie pas. */
  bonne_reponse?: number
  explication?: string
}

/** Aucune partie à montrer. `maintenant` sert quand même à recaler l'horloge. */
export type SansPartie = { partie: null; maintenant: string }

export type MaReponse = {
  choix: number
  /** Seulement après la correction. */
  correcte?: boolean
  points?: number
}

export type Moi = {
  points: number
  bonnes: number
  questions_closes: number
  /** Nul avant la première correction : tout le monde serait premier ex æquo. */
  rang: number | null
  participants: number
}

export type EtatEleve =
  | SansPartie
  | {
      partie: number
      titre: string
      phase: PhaseQuiz
      maintenant: string
      rejoint: boolean
      question: QuestionVue | null
      ma_reponse: MaReponse | null
      moi: Moi | null
      /**
       * En salle d'attente seulement : qui est déjà là, en « Prénom N. », comme
       * sur l'écran projeté. Vide dès que la partie commence.
       */
      joueurs: Joueur[]
    }

export type Joueur = { nom: string; moi: boolean }

export type Participant = { code_acces: string; prenom: string; nom: string }

export type PlaceProjetee = Participant & { points: number; rang: number }

export type LigneBilan = {
  rang: number
  enonce: string
  code: string
  options: string[]
  bonne_reponse: number
  repartition: number[]
  reponses: number
}

export type EtatProf =
  | SansPartie
  | {
      partie: number
      quiz_id: string
      titre: string
      phase: PhaseQuiz
      maintenant: string
      total_questions: number
      participants: Participant[]
      question: QuestionVue | null
      derniere: boolean
      reponses_recues: number
      repartition: number[] | null
      /** Cinq au plus, jamais quelqu'un à zéro point. Voir ADR-013. */
      podium: PlaceProjetee[]
      bilan: LigneBilan[] | null
    }

/** Ce qu'a laissé la dernière partie jouée d'un quiz. */
export type DernierePartie = {
  partie: number
  terminee_le: string
  joueurs: number
  reponses: number
  /** Réponses justes sur réponses données, de 0 à 1 ; nul sans réponse. */
  reussite: number | null
}

export type ResumeQuiz = {
  id: string
  titre: string
  seance: number
  questions: number
  duree_s: number
  derniere: DernierePartie | null
}

export type ResultatsQuiz = DernierePartie & {
  quiz_id: string
  titre: string
  bilan: LigneBilan[]
}

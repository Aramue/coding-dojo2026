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
  /**
   * Non nul pendant une pause : l'heure (serveur) où le temps s'est arrêté.
   * Le compte à rebours se fige sur `fin_a - pause_le`. On peut toujours
   * répondre : une réponse donnée pendant la pause vaut les points de cet
   * instant-là.
   */
  pause_le?: string | null
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
      /** Cinq au plus, jamais quelqu'un à zéro point. Voir ADR-015. */
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

/** Une question telle que le professeur la relit, bonne réponse comprise. */
export type QuestionComplete = {
  enonce: string
  code: string
  options: string[]
  bonne_reponse: number
  duree_s: number
  explication: string
}

/** Un quiz entier, pour le relire sans lancer de partie. Jamais envoyé à un élève. */
export type QuizComplet = Omit<ResumeQuiz, 'derniere' | 'questions'> & {
  questions: QuestionComplete[]
}

export type ResumeQuiz = {
  id: string
  titre: string
  seance: number
  questions: number
  duree_s: number
  derniere: DernierePartie | null
}

/**
 * Un joueur de la dernière partie, tel que « Derniers résultats » le classe.
 * Ni code d'accès ni jeton : un nom, un score, un rang.
 */
export type PlaceResultat = {
  prenom: string
  nom: string
  points: number
  bonnes: number
  rang: number
}

export type ResultatsQuiz = DernierePartie & {
  quiz_id: string
  titre: string
  bilan: LigneBilan[]
  /**
   * TOUS les joueurs, du premier au dernier, zéro compris. Seule cette page le
   * reçoit : l'écran de la partie, le podium et la fin de partie n'en montrent
   * jamais que trois (ADR-015).
   */
  classement: PlaceResultat[]
}

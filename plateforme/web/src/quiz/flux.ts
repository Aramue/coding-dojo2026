import { ecart, relectureA } from './horloge'
import type { PhaseQuiz, QuestionVue } from './types'

/**
 * La sonnette du quiz, et la relève qui la remplace quand elle se tait.
 *
 * Le WebSocket ne transporte jamais l'état : il dit « relis », et on relit par
 * le GET ordinaire (ADR-016). Il n'y a donc qu'un seul chemin de données, le
 * même avec ou sans WebSocket :
 *
 * - sonnette branchée : on relit à chaque sonnerie, et toutes les dix secondes
 *   par sûreté ;
 * - sonnette muette (réseau d'établissement qui la refuse, connexion tombée) :
 *   on relit chaque seconde, et on retente la sonnette en arrière-plan.
 *
 * S'y ajoute une relecture à l'échéance de chaque question : la correction ne
 * s'écrit pas côté serveur, personne ne sonne quand elle arrive.
 */

/** Ce que porte toute photographie, élève comme professeur. */
export type Photographie = {
  maintenant: string
  phase?: PhaseQuiz
  question?: QuestionVue | null
}

export const REPLI_MS = 1_000
export const SURETE_MS = 10_000
/** Délais entre deux tentatives de rebrancher la sonnette. */
export const RECONNEXIONS_MS = [1_000, 2_000, 5_000, 10_000] as const
/** Relecture minimale après une échéance déjà passée, le temps que le serveur la voie aussi. */
const RELANCE_ECHEANCE_MS = 500

/** Fermeture 4401 : la présentation est refusée. Rebrancher ne servirait à rien. */
const PRESENTATION_REFUSEE = 4401

export type OptionsFlux<E extends Photographie> = {
  /** Le GET de la photographie. Lève avec un message lisible en cas d'échec. */
  lire: () => Promise<E>
  /** Le premier message de la sonnette : `{ jeton }` ou `{ code_prof }`. Jamais l'URL. */
  presentation: () => Record<string, string>
  onEtat: (etat: E, ecartMs: number) => void
  /** Un message à montrer, ou `null` quand tout va de nouveau bien. */
  onErreur: (message: string | null) => void
  /** Injecté par les tests ; par défaut, un vrai WebSocket vers `/api/quiz/flux`. */
  ouvrirSocket?: () => WebSocket
  /**
   * La relève sans sonnette. Une seconde pendant une partie ; le bandeau et le
   * menu de l'élève, eux, se contentent de dix : sur un réseau qui refuse le
   * WebSocket, vingt-quatre onglets ne relisent pas chaque seconde pour rien.
   */
  repliMs?: number
}

export function urlSonnette(ou: Pick<Location, 'protocol' | 'host'> = location): string {
  const protocole = ou.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocole}//${ou.host}/api/quiz/flux`
}

export class FluxQuiz<E extends Photographie> {
  private socket: WebSocket | null = null
  private branche = false
  private arrete = true
  private tentatives = 0
  private enCours = false
  private encore = false
  /** L'envoi de la dernière action dont on a appliqué la réponse. */
  private ecritureA = -Infinity
  private minuteurReleve: ReturnType<typeof setTimeout> | undefined
  private minuteurEcheance: ReturnType<typeof setTimeout> | undefined
  private minuteurReconnexion: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly options: OptionsFlux<E>) {}

  /** Vrai quand la sonnette est branchée ; faux pendant le repli. */
  get sonnetteBranchee(): boolean {
    return this.branche
  }

  demarrer(): void {
    if (!this.arrete) return
    this.arrete = false
    void this.relire()
    this.brancher()
  }

  arreter(): void {
    this.arrete = true
    clearTimeout(this.minuteurReleve)
    clearTimeout(this.minuteurEcheance)
    clearTimeout(this.minuteurReconnexion)
    const socket = this.socket
    // Oublié AVANT de fermer : son `onclose` se reconnaît alors comme périmé et
    // ne relance ni relève ni reconnexion.
    this.socket = null
    this.branche = false
    socket?.close()
  }

  /**
   * Relit la photographie.
   *
   * Deux relectures ne se chevauchent jamais : une réponse lente arrivée après
   * une plus récente remettrait à l'écran une question déjà corrigée. Une
   * demande faite pendant une relecture en déclenche une seule autre, après.
   */
  async relire(): Promise<void> {
    if (this.arrete) return
    if (this.enCours) {
      this.encore = true
      return
    }
    this.enCours = true
    try {
      do {
        this.encore = false
        const envoiA = Date.now()
        try {
          const etat = await this.options.lire()
          if (this.arrete) return
          // Partie avant la dernière action, cette lecture peut rapporter
          // l'état d'avant — le catalogue une seconde après la création de la
          // partie. On l'écarte : la réponse de l'action est au moins aussi
          // fraîche, et la relève suivante suivra.
          if (envoiA <= this.ecritureA) continue
          this.appliquer(etat, envoiA)
        } catch (erreur) {
          if (this.arrete) return
          this.options.onErreur(
            erreur instanceof Error ? erreur.message : 'La plateforme ne répond pas.',
          )
        }
      } while (this.encore)
    } finally {
      this.enCours = false
      this.planifierReleve()
    }
  }

  /**
   * Prend la photographie rendue par une action — un POST rend l'état à jour —
   * comme si elle avait été relue. `envoiA` : l'instant où l'action est partie.
   */
  recevoir(etat: E, envoiA: number): void {
    this.ecritureA = Math.max(this.ecritureA, envoiA)
    this.appliquer(etat, envoiA)
  }

  private appliquer(etat: E, envoiA: number): void {
    const ecartMs = ecart(etat.maintenant, envoiA, Date.now())
    this.options.onErreur(null)
    this.options.onEtat(etat, ecartMs)
    this.planifierEcheance(etat, ecartMs)
  }

  private planifierReleve(): void {
    clearTimeout(this.minuteurReleve)
    if (this.arrete) return
    this.minuteurReleve = setTimeout(
      () => void this.relire(),
      this.branche ? SURETE_MS : (this.options.repliMs ?? REPLI_MS),
    )
  }

  private planifierEcheance(etat: E, ecartMs: number): void {
    clearTimeout(this.minuteurEcheance)
    if (this.arrete || etat.phase !== 'question' || !etat.question) return
    const dans = relectureA(etat.question.fin_a, ecartMs) - Date.now()
    this.minuteurEcheance = setTimeout(
      () => void this.relire(),
      Math.max(dans, RELANCE_ECHEANCE_MS),
    )
  }

  // Ni `brancher` ni `reconnecterPlusTard` ne vérifient `arrete` : `arreter()`
  // annule le minuteur de reconnexion et oublie la socket avant de la fermer,
  // si bien qu'aucun des deux n'est plus jamais appelé une fois arrêté.
  private brancher(): void {
    let socket: WebSocket
    try {
      socket = this.options.ouvrirSocket
        ? this.options.ouvrirSocket()
        : new WebSocket(urlSonnette())
    } catch {
      this.reconnecterPlusTard()
      return
    }
    this.socket = socket

    socket.onopen = () => socket.send(JSON.stringify(this.options.presentation()))
    socket.onmessage = (evenement: MessageEvent) => {
      let type: unknown
      try {
        type = (JSON.parse(String(evenement.data)) as { type?: unknown } | null)?.type
      } catch {
        return
      }
      if (type === 'pret') {
        this.branche = true
        this.tentatives = 0
        // Une sonnerie a pu partir entre la première lecture et l'inscription :
        // on relit une fois, et la relève passe au rythme de sûreté.
        void this.relire()
      } else if (type === 'changement') {
        void this.relire()
      }
    }
    // `onerror` est toujours suivi de `onclose` : c'est lui seul qui décide.
    socket.onclose = (evenement: CloseEvent) => {
      if (this.socket !== socket) return
      this.socket = null
      this.branche = false
      this.planifierReleve()
      if (evenement.code !== PRESENTATION_REFUSEE) this.reconnecterPlusTard()
    }
  }

  private reconnecterPlusTard(): void {
    const delai = RECONNEXIONS_MS[Math.min(this.tentatives, RECONNEXIONS_MS.length - 1)]
    this.tentatives += 1
    clearTimeout(this.minuteurReconnexion)
    this.minuteurReconnexion = setTimeout(() => this.brancher(), delai)
  }
}

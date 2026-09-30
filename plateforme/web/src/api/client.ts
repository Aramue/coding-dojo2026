import type { EtatEleve } from '../quiz/types'
import type { Reussite, Verdict } from '../validation/types'

/** Qui est connecté. `prenom` est vide tant que le professeur n'a rien saisi. */
export type Identite = { codeAcces: string; prenom: string }

export type TentativeAEnvoyer = {
  exerciceId: string
  verdict: Verdict
  typeErreur: string | null
  dureeMs: number
}

export class ClientApi {
  private jeton: string | null = null

  constructor(
    private base = '/api',
    // `fetch` doit être lié à son contexte global. Appelé comme méthode
    // (`this.executerRequete(...)`), un `fetch` non lié reçoit l'instance de
    // ClientApi comme `this` et lève « Illegal invocation » dans un navigateur.
    // Invisible en test, où `fetch` est remplacé par une doublure.
    private executerRequete: typeof fetch = fetch.bind(globalThis),
  ) {}

  async ouvrirSession(codeAcces: string): Promise<Identite> {
    let reponse: Response
    try {
      reponse = await this.executerRequete(`${this.base}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_acces: codeAcces }),
      })
    } catch {
      // Distinguer la panne du code refusé : sinon l'élève essaie d'autres codes
      // pendant que le vrai problème est que le service ne répond pas.
      throw new Error('La plateforme ne répond pas. Préviens ton professeur.')
    }
    if (reponse.status === 422) {
      throw new Error("Ce code d'accès n'est pas reconnu. Vérifie qu'il est de la forme DOJO-XXXX.")
    }
    // 404 : le code est bien formé mais n'est pas dans la liste de la classe.
    // Le distinguer d'une faute de forme évite à l'élève de relire vingt fois
    // un code correctement tapé qui n'a simplement jamais été créé.
    if (reponse.status === 404) {
      throw new Error(
        "Ce code n'existe pas. Vérifie chaque caractère, puis demande-le à ton professeur.",
      )
    }
    // 429 : nginx borne cette route, parce qu'un code d'accès de quatre
    // caractères s'essaie sinon en entier. Une classe qui arrive ensemble passe
    // sous la rafale ; si la limite tombe quand même, dire d'attendre vaut
    // mieux que « préviens ton professeur », qui fait lever la main pour
    // quelque chose qui se résout tout seul en quelques secondes.
    if (reponse.status === 429) {
      throw new Error("Trop d'essais d'un coup. Attends quelques secondes et réessaie.")
    }
    if (!reponse.ok) {
      throw new Error('La plateforme a un problème. Préviens ton professeur.')
    }
    const donnees = await reponse.json()
    this.jeton = donnees.jeton
    return { codeAcces: donnees.code_acces, prenom: donnees.prenom ?? '' }
  }

  private entetes(): Record<string, string> {
    if (!this.jeton) throw new Error('Session non ouverte.')
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.jeton}` }
  }

  async lireParcours(): Promise<Reussite[]> {
    const reponse = await this.executerRequete(`${this.base}/parcours`, { headers: this.entetes() })
    if (!reponse.ok) throw new Error('Progression indisponible.')
    const brut = (await reponse.json()).reussis
    if (!Array.isArray(brut)) throw new Error('Progression indisponible.')
    return brut.map((l: { exercice_id: string; verdict: Verdict; le: string }) => ({
      exerciceId: l.exercice_id,
      verdict: l.verdict,
      le: l.le,
    }))
  }

  /**
   * N'envoie jamais le code source : contrainte globale du projet.
   * `typeErreur` est un nom d'exception Python, jamais un message.
   *
   * Lève si l'enregistrement échoue. L'appelant ne doit pas faire avancer
   * l'élève sur une tentative non enregistrée : il la croirait acquise et la
   * retrouverait à faire au rechargement, sans explication.
   */
  async enregistrerTentative(t: TentativeAEnvoyer): Promise<void> {
    let reponse: Response
    try {
      reponse = await this.executerRequete(`${this.base}/tentative`, {
        method: 'POST',
        headers: this.entetes(),
        body: JSON.stringify({
          exercice_id: t.exerciceId,
          verdict: t.verdict,
          type_erreur: t.typeErreur,
          duree_ms: t.dureeMs,
        }),
      })
    } catch {
      throw new Error('Progression non enregistrée : la plateforme ne répond pas.')
    }
    if (!reponse.ok) {
      throw new Error(`Progression non enregistrée (erreur ${reponse.status}).`)
    }
  }

  /**
   * Le premier message de la sonnette du quiz. Le jeton passe là, jamais dans
   * l'URL du WebSocket, qui finirait dans les journaux du proxy. Voir ADR-016.
   */
  presentationQuiz(): { jeton: string } {
    if (!this.jeton) throw new Error('Session non ouverte.')
    return { jeton: this.jeton }
  }

  lireQuiz(): Promise<EtatEleve> {
    return this.appelerQuiz('/quiz/etat')
  }

  rejoindreQuiz(): Promise<EtatEleve> {
    return this.appelerQuiz('/quiz/rejoindre', { method: 'POST' })
  }

  /** Un numéro d'option, et rien d'autre : ni texte, ni code. */
  repondreQuiz(partie: number, question: number, choix: number): Promise<EtatEleve> {
    return this.appelerQuiz('/quiz/reponse', {
      method: 'POST',
      body: JSON.stringify({ partie, question, choix }),
    })
  }

  private async appelerQuiz(chemin: string, options: RequestInit = {}): Promise<EtatEleve> {
    let reponse: Response
    try {
      reponse = await this.executerRequete(`${this.base}${chemin}`, {
        ...options,
        headers: this.entetes(),
      })
    } catch {
      throw new Error('La plateforme ne répond pas. Préviens ton professeur.')
    }
    const donnees = await reponse.json().catch(() => null)
    if (!reponse.ok) throw new Error(messageRefus(donnees, reponse.status))
    // Même garde que le tableau de bord : une réponse d'une autre forme mise
    // dans l'état ferait planter le rendu, et l'élève verrait un écran blanc.
    if (!estPhotographie(donnees)) throw new Error('Réponse inattendue de la plateforme.')
    return donnees as EtatEleve
  }
}

/**
 * Le message à montrer quand l'API refuse.
 *
 * Les refus du quiz sont écrits pour l'élève, en français (« Le temps de
 * réponse est écoulé. ») : on les montre tels quels. Une erreur de validation
 * FastAPI, elle, porte une liste technique — on ne la montre jamais.
 */
export function messageRefus(donnees: unknown, statut: number): string {
  const detail = (donnees as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  return `La plateforme a refusé (erreur ${statut}).`
}

export function estPhotographie(donnees: unknown): boolean {
  return (
    typeof donnees === 'object' &&
    donnees !== null &&
    'partie' in donnees &&
    typeof (donnees as { maintenant?: unknown }).maintenant === 'string'
  )
}

import type { Verdict } from '../validation/types'

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

  async ouvrirSession(codeAgent: string): Promise<string> {
    let reponse: Response
    try {
      reponse = await this.executerRequete(`${this.base}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_agent: codeAgent }),
      })
    } catch {
      // Distinguer la panne du code refusé : sinon l'élève essaie d'autres codes
      // pendant que le vrai problème est que le service ne répond pas.
      throw new Error('La plateforme ne répond pas. Préviens ton professeur.')
    }
    if (reponse.status === 422) {
      throw new Error("Ce code d'agent n'est pas reconnu. Vérifie qu'il est de la forme AGENT-XXXX.")
    }
    if (!reponse.ok) {
      throw new Error('La plateforme a un problème. Préviens ton professeur.')
    }
    const donnees = await reponse.json()
    this.jeton = donnees.jeton
    return donnees.code_agent
  }

  private entetes(): Record<string, string> {
    if (!this.jeton) throw new Error('Session non ouverte.')
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.jeton}` }
  }

  async lireParcours(): Promise<string[]> {
    const reponse = await this.executerRequete(`${this.base}/parcours`, { headers: this.entetes() })
    if (!reponse.ok) throw new Error('Progression indisponible.')
    return (await reponse.json()).reussis
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
}

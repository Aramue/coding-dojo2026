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
    // `fetch` nu échoue en navigateur réel : appelé via `this.executerRequete(...)`,
    // `this` vaut l'instance de ClientApi et non `window`, ce que l'implémentation
    // native de fetch exige ("Illegal invocation"). Le lier corrige l'appel sans
    // changer la signature `typeof fetch` attendue par les tests.
    private executerRequete: typeof fetch = fetch.bind(globalThis),
  ) {}

  async ouvrirSession(codeAgent: string): Promise<string> {
    const reponse = await this.executerRequete(`${this.base}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_agent: codeAgent }),
    })
    if (!reponse.ok) {
      throw new Error("Ce code d'agent n'est pas reconnu. Vérifie qu'il est de la forme AGENT-XXXX.")
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

  /** N'envoie jamais le code source : contrainte globale du projet. */
  async enregistrerTentative(t: TentativeAEnvoyer): Promise<void> {
    await this.executerRequete(`${this.base}/tentative`, {
      method: 'POST',
      headers: this.entetes(),
      body: JSON.stringify({
        exercice_id: t.exerciceId,
        verdict: t.verdict,
        type_erreur: t.typeErreur,
        duree_ms: t.dureeMs,
      }),
    })
  }
}

import type { ResultatExecution } from './types'

export type DemandeExecution = {
  code: string
  entrees: string[]
  /** Variables à relire dans l'espace de noms après exécution */
  nomsVariables: string[]
}

const TIMEOUT_PAR_DEFAUT = 5000

/**
 * Pilote le worker Pyodide depuis le fil principal.
 *
 * Le minuteur est ici et non dans le worker : un worker bloqué dans une boucle
 * infinie ne peut plus traiter aucun message, y compris un ordre d'arrêt.
 * Le seul recours est terminate() depuis l'extérieur.
 */
export class Executeur {
  private worker: Worker | null = null
  private compteur = 0

  constructor(
    private fabrique: () => Worker,
    private timeoutMs: number = TIMEOUT_PAR_DEFAUT,
  ) {}

  private obtenirWorker(): Worker {
    if (!this.worker) this.worker = this.fabrique()
    return this.worker
  }

  executer(demande: DemandeExecution): Promise<ResultatExecution> {
    const worker = this.obtenirWorker()
    const id = `e${++this.compteur}`
    const debut = Date.now()

    return new Promise<ResultatExecution>((resoudre) => {
      const minuteur = setTimeout(() => {
        worker.terminate()
        this.worker = null
        resoudre({
          stdout: '',
          erreur: { type: 'TimeoutError', message: '', ligne: null },
          variables: {},
          dureeMs: Date.now() - debut,
          timeout: true,
        })
      }, this.timeoutMs)

      worker.onmessage = (evenement: MessageEvent) => {
        const message = evenement.data
        if (!message || message.id !== id) return
        clearTimeout(minuteur)
        if (message.ok) {
          resoudre({ ...message.charge, dureeMs: Date.now() - debut, timeout: false })
        } else {
          resoudre({
            stdout: '',
            erreur: { type: 'ErreurInterne', message: String(message.message), ligne: null },
            variables: {},
            dureeMs: Date.now() - debut,
            timeout: false,
          })
        }
      }

      worker.postMessage({ id, ...demande })
    })
  }

  detruire(): void {
    this.worker?.terminate()
    this.worker = null
  }
}

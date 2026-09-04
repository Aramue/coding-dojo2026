import type { ResultatExecution } from './types'

export type DemandeExecution = {
  code: string
  entrees: string[]
  /** Variables à relire dans l'espace de noms après exécution */
  nomsVariables: string[]
  /**
   * Appelée à chaque écriture sur stdout, pendant l'exécution.
   *
   * Le résultat final porte de toute façon `stdout` en entier ; ce rappel sert
   * à l'afficher AU FUR ET À MESURE — et à montrer ce qu'une boucle infinie a
   * écrit avant d'être coupée, cas où le résultat final ne contient rien.
   */
  onSortie?: (morceau: string) => void
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
    const { onSortie, ...aEnvoyer } = demande
    const worker = this.obtenirWorker()
    const id = `e${++this.compteur}`
    const debut = Date.now()
    // Ce que le programme a écrit avant d'être coupé : le résultat d'un
    // dépassement de temps ne contient aucun stdout, alors que l'élève a
    // souvent besoin de voir ce que sa boucle affichait.
    let diffuse = ''

    return new Promise<ResultatExecution>((resoudre) => {
      const minuteur = setTimeout(() => {
        worker.terminate()
        this.worker = null
        resoudre({
          stdout: diffuse,
          erreur: { type: 'TimeoutError', message: '', ligne: null },
          variables: {},
          dureeMs: Date.now() - debut,
          timeout: true,
        })
      }, this.timeoutMs)

      worker.onmessage = (evenement: MessageEvent) => {
        const message = evenement.data
        if (!message || message.id !== id) return
        if (typeof message.flux === 'string') {
          diffuse += message.flux
          onSortie?.(message.flux)
          return
        }
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

      worker.postMessage({ id, ...aEnvoyer })
    })
  }

  detruire(): void {
    this.worker?.terminate()
    this.worker = null
  }
}

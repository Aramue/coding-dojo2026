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
 * Le temps laissé à Python pour DÉMARRER, avant la première exécution.
 *
 * Il ne se confond pas avec les 5 secondes du programme. Charger Pyodide prend
 * 3,5 à 4 s sur une machine rapide, bien davantage sur un PC de salle : compté
 * dans les 5 secondes, ce chargement faisait déclarer « Ton programme tourne en
 * rond » un programme juste — et, le worker relancé à froid après chaque
 * dépassement, l'exercice suivant retombait dans le même piège.
 */
const DEMARRAGE_PAR_DEFAUT = 60_000

/**
 * Pilote le worker Pyodide depuis le fil principal.
 *
 * Le minuteur est ici et non dans le worker : un worker bloqué dans une boucle
 * infinie ne peut plus traiter aucun message, y compris un ordre d'arrêt.
 * Le seul recours est terminate() depuis l'extérieur.
 *
 * Il y a DEUX minuteurs. Le premier couvre le démarrage de Python ; le second,
 * les 5 secondes du programme, ne part qu'au message `demarre` du worker,
 * quand le code de l'élève commence vraiment à tourner.
 */
export class Executeur {
  private worker: Worker | null = null
  private compteur = 0

  constructor(
    private fabrique: () => Worker,
    private timeoutMs: number = TIMEOUT_PAR_DEFAUT,
    private demarrageMs: number = DEMARRAGE_PAR_DEFAUT,
  ) {}

  private obtenirWorker(): Worker {
    if (!this.worker) this.worker = this.fabrique()
    return this.worker
  }

  /**
   * Crée le worker sans rien exécuter : Python démarre en arrière-plan, et la
   * première validation n'a plus à l'attendre. Sans effet s'il existe déjà.
   */
  prechauffer(): void {
    this.obtenirWorker()
  }

  /** Tue le worker, et en relance un tout de suite pour que le suivant soit prêt. */
  private remplacerWorker(): void {
    this.worker?.terminate()
    this.worker = null
    this.prechauffer()
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
      // Python n'a pas démarré à temps : ce n'est PAS le programme de l'élève.
      // On ne dit pas « tourne en rond », et on ne compte pas cela comme un
      // dépassement de temps.
      let minuteur = setTimeout(() => {
        this.remplacerWorker()
        resoudre({
          stdout: '',
          erreur: { type: 'DemarrageImpossible', message: '', ligne: null },
          variables: {},
          dureeMs: Date.now() - debut,
          timeout: false,
        })
      }, this.demarrageMs)

      worker.onmessage = (evenement: MessageEvent) => {
        const message = evenement.data
        if (!message || message.id !== id) return
        if (message.demarre === true) {
          // Le programme commence : ses 5 secondes partent d'ici.
          clearTimeout(minuteur)
          minuteur = setTimeout(() => {
            this.remplacerWorker()
            resoudre({
              stdout: diffuse,
              erreur: { type: 'TimeoutError', message: '', ligne: null },
              variables: {},
              dureeMs: Date.now() - debut,
              timeout: true,
            })
          }, this.timeoutMs)
          return
        }
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

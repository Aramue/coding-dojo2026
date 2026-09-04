import { useEffect, useMemo, useState } from 'react'
import type { Exercice } from '../contenu/types'
import { nomsVariablesRequis } from '../contenu/chargeur'
import { Executeur } from '../execution/executeur'
import { categorieErreur } from '../execution/exceptions'
import type { ResultatExecution } from '../execution/types'
import { evaluer } from '../validation/evaluer'
import type { ResultatTest, Test } from '../validation/types'
import { CarteCode } from './CarteCode'
import { Editeur } from './Editeur'
import { PanneauVerdict } from './PanneauVerdict'

const EXECUTION_VIDE: ResultatExecution = {
  stdout: '',
  erreur: null,
  variables: {},
  dureeMs: 0,
  timeout: false,
}

const SEUIL_INDICE = 2 // le deuxième indice se débloque après 2 essais infructueux

export function EcranExercice({
  exercice,
  executeur,
  onTentative,
}: {
  exercice: Exercice
  executeur: Executeur
  /**
   * Appelée à CHAQUE validation, réussie ou non — d'où le nom.
   *
   * `typeErreurPython` est le NOM de l'exception (`NameError`, `TypeError`…),
   * jamais un message. Les messages de verdict contiennent des identifiants
   * tapés par l'élève : les transmettre ferait sortir du code source de son
   * navigateur, ce que l'architecture interdit.
   */
  onTentative: (
    resultat: ResultatTest,
    dureeMs: number,
    typeErreurPython: string | null,
  ) => void
}) {
  const [code, setCode] = useState(exercice.depart)
  const [resultat, setResultat] = useState<ResultatTest | null>(null)
  const [essais, setEssais] = useState(0)
  const [reponseQcm, setReponseQcm] = useState<number | undefined>(undefined)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    setCode(exercice.depart)
    setResultat(null)
    setEssais(0)
    setReponseQcm(undefined)
  }, [exercice.id, exercice.depart])

  const noms = useMemo(() => nomsVariablesRequis(exercice), [exercice])
  // Prédicat de type : `Test` est une union discriminée, `.find()` seul ne
  // suffit pas à donner accès aux champs propres à une variante.
  const qcm = exercice.tests.find((t): t is Extract<Test, { type: 'qcm' }> => t.type === 'qcm')

  async function valider() {
    setEnCours(true)

    // Une exécution par test, avec les entrées qui LUI appartiennent : un
    // exercice comme s1-30/s1-31/s1-34 déclare plusieurs tests 'sortie' avec
    // des entrées différentes (pour vérifier que la solution généralise, pas
    // seulement le premier exemple). Réutiliser une seule exécution partagée
    // comparerait la sortie obtenue avec des entrées A à l'attendu écrit pour
    // des entrées B. Les exécutions identiques (même jeu d'entrées) sont mises
    // en cache pour ne pas relancer Pyodide inutilement, et lancées l'une
    // après l'autre : l'Executeur ne pilote qu'un seul worker à la fois, un
    // second appel concurrent écraserait le gestionnaire de réponse du
    // premier et le ferait expirer en silence (voir executeur.ts).
    const executions: ResultatExecution[] = []
    if (exercice.type === 'predire') {
      executions.push(...exercice.tests.map(() => EXECUTION_VIDE))
    } else {
      const cache = new Map<string, ResultatExecution>()
      for (const test of exercice.tests) {
        // Le test 'variable' relit l'espace de noms d'une exécution sans
        // entrée (miroir de valider_contenu.py::_passe). 'interdit',
        // 'contient' et 'qcm' n'inspectent jamais l'exécution : inutile de
        // solliciter Pyodide pour eux.
        const entrees = test.type === 'sortie' ? test.entrees : test.type === 'variable' ? [] : null
        if (entrees === null) {
          executions.push(EXECUTION_VIDE)
          continue
        }
        const cle = JSON.stringify(entrees)
        let resultat = cache.get(cle)
        if (!resultat) {
          resultat = await executeur.executer({ code, entrees, nomsVariables: noms })
          cache.set(cle, resultat)
        }
        executions.push(resultat)
      }
    }

    const evalue = evaluer({ code, tests: exercice.tests, executions, reponseQcm })
    setResultat(evalue)
    setEssais((n) => n + 1)
    setEnCours(false)

    const dureeTotaleMs = executions.reduce((total, e) => total + e.dureeMs, 0)
    const enErreur = executions.find((e) => e.timeout || e.erreur)
    onTentative(
      evalue,
      dureeTotaleMs,
      // Filtré par liste blanche : un nom d'exception peut être choisi par l'élève.
      categorieErreur(enErreur?.timeout ? 'TimeoutError' : enErreur?.erreur?.type),
    )
  }

  const indicesVisibles = exercice.indices.slice(0, essais >= SEUIL_INDICE ? exercice.indices.length : 1)

  return (
    <main className="exercice" data-famille={exercice.famille}>
      <div className="exercice__entete">
        <h1 className="exercice__titre">{exercice.titre}</h1>
        <span className="exercice__essais">
          {essais === 0 ? 'aucun essai' : `${essais} essai${essais > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="exercice__grille">
        <section className="exercice__enonce">
          <p>{exercice.enonce.trim()}</p>

          {/*
            Un exercice « predire » demande de LIRE un programme : sans cet
            affichage, l'élève voit les propositions sans le code, et les douze
            exercices de ce type sont impossibles à faire.
          */}
          {qcm && exercice.depart.trim() && (
            <CarteCode legende="Le programme">
              <pre>{exercice.depart.trimEnd()}</pre>
            </CarteCode>
          )}

          {indicesVisibles.map((indice, i) => (
            <p key={i} className="indice">
              <b>Indice {i + 1}</b>
              <span>{indice}</span>
            </p>
          ))}
          {exercice.indices.length > indicesVisibles.length && (
            <p className="indice indice--verrouille">
              <b>Indice {indicesVisibles.length + 1}</b>
              <span>Encore un essai avant de le débloquer.</span>
            </p>
          )}
        </section>

        <section className="exercice__travail">
          {qcm ? (
            <fieldset className="qcm">
              <legend>Qu'affiche ce programme&nbsp;?</legend>
              {qcm.options.map((option, i) => (
                <label key={i} className="qcm__option">
                  <input
                    type="radio"
                    name="qcm"
                    checked={reponseQcm === i}
                    onChange={() => setReponseQcm(i)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <Editeur valeur={code} onChange={setCode} />
          )}

          <div className="exercice__actions">
            <button
              type="button"
              className="bouton bouton--primaire"
              onClick={valider}
              disabled={enCours || (Boolean(qcm) && reponseQcm === undefined)}
            >
              {enCours ? 'Exécution…' : 'Valider'}
            </button>
            <span className="exercice__note">exécuté dans ton navigateur</span>
          </div>

          <PanneauVerdict resultat={resultat} />
        </section>
      </div>
    </main>
  )
}

/**
 * La batterie d'essais de l'atelier.
 *
 * Elle rejoue ce que fait `outils/valider_contenu.py` à la construction, mais
 * ==par le moteur de l'élève== : Pyodide exécute, `evaluer()` juge. C'est plus
 * fidèle que le miroir Python, puisque c'est exactement ce que la classe
 * rencontrera.
 *
 * L'atelier prévient ; la construction tranche. `valider_contenu.py` reste le
 * juge, et fait échouer le déploiement.
 */

import { nomsVariablesRequis } from '../contenu/chargeur'
import type { Notion } from '../contenu/types'
import type { Executeur } from '../execution/executeur'
import type { ResultatExecution } from '../execution/types'
import { evaluer } from '../validation/evaluer'
import type { Test } from '../validation/types'
import { versExercice, type Brouillon } from './brouillon'

export type Essai = { titre: string; verdict: 'vert' | 'rouge'; detail?: string }

const EXECUTION_VIDE: ResultatExecution = {
  stdout: '',
  erreur: null,
  variables: {},
  dureeMs: 0,
  timeout: false,
}

/** Les entrées qu'un test impose à l'exécution, ou `null` s'il n'en lance aucune. */
function entreesDu(test: Test): string[] | null {
  if (test.type === 'sortie') return test.entrees
  // Un test 'variable' relit l'espace de noms d'une exécution sans entrée.
  // 'interdit', 'contient' et 'qcm' n'inspectent jamais l'exécution.
  if (test.type === 'variable') return []
  return null
}

/**
 * Une exécution par test, avec les entrées qui LUI appartiennent.
 *
 * Miroir de `valider_contenu.py::_passe`, et de ce que fait l'écran de
 * l'élève. Réutiliser une exécution partagée comparerait la sortie obtenue
 * avec des entrées A à l'attendu écrit pour des entrées B, et refuserait à
 * tort un exercice à plusieurs jeux d'entrées.
 */
async function executerPourChaqueTest(
  code: string,
  tests: Test[],
  noms: string[],
  executeur: Executeur,
): Promise<ResultatExecution[]> {
  const executions: ResultatExecution[] = []
  const cache = new Map<string, ResultatExecution>()
  for (const test of tests) {
    const entrees = entreesDu(test)
    if (entrees === null) {
      executions.push(EXECUTION_VIDE)
      continue
    }
    const cle = JSON.stringify(entrees)
    let resultat = cache.get(cle)
    if (!resultat) {
      // L'une après l'autre : l'Executeur ne pilote qu'un seul worker, et un
      // second appel concurrent ferait expirer le premier en silence.
      resultat = await executeur.executer({ code, entrees, nomsVariables: noms })
      cache.set(cle, resultat)
    }
    executions.push(resultat)
  }
  return executions
}

/**
 * Les deux règles de chaîne de `verifier_coherence`.
 *
 * ==Miroir assumé==, de la même famille que `evaluer` miroir de `_passe`, ou
 * que la liste blanche des types d'erreur de l'API qui double celle du
 * navigateur. Chaque règle porte le nom de sa contrepartie.
 */
function essaisDesMotifs(brouillon: Brouillon): Essai[] {
  const essais: Essai[] = []
  for (const test of brouillon.tests) {
    if (test.type !== 'interdit') continue

    if (brouillon.solution.includes(test.motif)) {
      essais.push({
        titre: 'Aucun motif interdit dans la solution',
        verdict: 'rouge',
        detail: `La solution contient son propre motif interdit « ${test.motif} ».`,
      })
    }
    if (test.motif.includes('"') || test.motif.includes("'")) {
      essais.push({
        titre: 'Aucun motif ne dépend de la ponctuation',
        verdict: 'rouge',
        detail:
          `Le motif « ${test.motif} » contient un guillemet : il se contourne en ` +
          'changeant de ponctuation. Un motif nu bloque toutes les formes.',
      })
    }
  }
  return essais
}

export async function eprouver(
  brouillon: Brouillon,
  notions: Notion[],
  executeur: Executeur,
): Promise<Essai[]> {
  const exercice = versExercice(brouillon, notions)
  const noms = nomsVariablesRequis(exercice)
  const essais: Essai[] = []

  if (brouillon.type === 'predire') {
    // `verifier_coherence` n'exécute rien sur un `predire`, donc la bonne
    // réponse du QCM n'est vérifiée par aucun outil — elle l'a été à la main
    // pour les douze exercices de la séance 1. L'atelier montre la sortie et
    // laisse l'auteur juger : il n'affirme rien à sa place.
    const resultat = await executeur.executer({ code: brouillon.solution, entrees: [], nomsVariables: noms })
    essais.push(
      resultat.erreur || resultat.timeout
        ? {
            titre: 'Ce que produit la solution',
            verdict: 'rouge',
            detail: resultat.timeout
              ? 'Le programme ne s’arrête pas.'
              : `Le programme plante : ${resultat.erreur?.type}.`,
          }
        : {
            titre: 'Ce que produit la solution',
            verdict: 'vert',
            detail: `Compare-le à la bonne réponse du QCM :\n${resultat.stdout}`,
          },
    )
  } else {
    const executions = await executerPourChaqueTest(
      brouillon.solution,
      brouillon.tests,
      noms,
      executeur,
    )
    const jugement = evaluer({ code: brouillon.solution, tests: brouillon.tests, executions })
    // On exige le VERT, critères de maîtrise compris : une solution qui
    // n'emploie pas la méthode que l'exercice récompense ne sert de modèle à
    // personne.
    essais.push(
      jugement.verdict === 'vert'
        ? { titre: 'La solution passe tous ses tests', verdict: 'vert' }
        : {
            titre: 'La solution passe tous ses tests',
            verdict: 'rouge',
            detail: [jugement.titre, jugement.detail].filter(Boolean).join(' — '),
          },
    )
  }

  if (brouillon.depart.trim()) {
    const executions = await executerPourChaqueTest(
      brouillon.depart,
      brouillon.tests,
      noms,
      executeur,
    )
    const jugement = evaluer({ code: brouillon.depart, tests: brouillon.tests, executions })
    // Du départ on demande seulement s'il est déjà VALIDE aux yeux de l'élève :
    // un critère de maîtrise manquant ne bloque pas dans le navigateur, et le
    // compter ici masquerait un départ qui résout déjà l'exercice.
    // `evaluer` rend justement `bleu` dans ce cas, pas `rouge`.
    essais.push(
      jugement.verdict === 'rouge'
        ? { titre: 'Le code de départ échoue', verdict: 'vert' }
        : {
            titre: 'Le code de départ échoue',
            verdict: 'rouge',
            detail: "Le code de départ passe déjà les tests : l'exercice est déjà résolu.",
          },
    )
  }

  const motifs = essaisDesMotifs(brouillon)
  if (motifs.length > 0) return [...essais, ...motifs]
  return [...essais, { titre: 'Les motifs interdits tiennent', verdict: 'vert' }]
}

/**
 * La sortie de la solution pour les entrées d'un test, à écrire dans son
 * `attendu`.
 *
 * C'est `outils/generer_attendu.py` déplacé dans le navigateur, et le plus
 * gros gain de temps de l'atelier : ==un attendu tapé à la main est la classe
 * d'erreur la plus probable==.
 */
export async function remplirAttendu(
  brouillon: Brouillon,
  index: number,
  executeur: Executeur,
): Promise<string> {
  const test = brouillon.tests[index]
  if (!test || test.type !== 'sortie') {
    throw new Error("Seul un test de sortie a un attendu à remplir.")
  }
  const resultat = await executeur.executer({
    code: brouillon.solution,
    entrees: test.entrees,
    nomsVariables: [],
  })
  if (resultat.timeout) throw new Error('Le programme tourne en rond : rien à écrire.')
  if (resultat.erreur) throw new Error(`Le programme plante (${resultat.erreur.type}) : rien à écrire.`)
  return resultat.stdout
}

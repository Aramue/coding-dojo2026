import type { ResultatExecution } from '../execution/types'
import { diffCaracteres, rendreVisible } from './diff'
import { traduireErreur } from './erreurs'
import { normaliser } from './normaliser'
import type { ResultatTest, Test, Verdict } from './types'

// Gelé : cet objet est renvoyé par référence depuis six points. Sans freeze, un
// appelant qui l'enrichirait en place contaminerait tous les verdicts verts suivants.
const VERT: ResultatTest = Object.freeze({ verdict: 'vert', titre: "C'est juste." })

export function evaluer(params: {
  code: string
  tests: Test[]
  /**
   * Une exécution par test, alignée par index sur `tests`.
   *
   * Un test 'sortie' peut déclarer son propre jeu d'entrées (plusieurs
   * exemples différents pour vérifier que la solution généralise, pas
   * seulement le premier). Chaque test doit donc être confronté à
   * l'exécution qui correspond à SES entrées, jamais à une exécution
   * partagée : sinon un exercice à plusieurs tests 'sortie' (s1-30, s1-31,
   * s1-34...) compare la sortie obtenue avec des entrées A à l'attendu écrit
   * pour des entrées B, et une solution correcte est refusée à tort. Miroir
   * de outils/valider_contenu.py::_passe, qui ré-exécute pour chaque test.
   */
  executions: ResultatExecution[]
  reponseQcm?: number
}): ResultatTest {
  const { code, tests, executions, reponseQcm } = params

  // 1. Le programme s'est-il exécuté ? On vérifie chaque exécution utilisée,
  // pas seulement la première : un jeu d'entrées peut planter pendant qu'un
  // autre réussit.
  for (const execution of executions) {
    if (execution.timeout) {
      const m = traduireErreur({ type: 'TimeoutError', message: '', ligne: null })
      return { verdict: 'rouge', titre: m.titre, detail: `${m.explication} ${m.piste}` }
    }
    if (execution.erreur) {
      const m = traduireErreur(execution.erreur)
      return { verdict: 'rouge', titre: m.titre, detail: `${m.explication} ${m.piste}` }
    }
  }

  // 2. Les contraintes de méthode passent avant tout : elles disqualifient la réponse.
  for (const test of tests) {
    if (test.type === 'interdit' && code.includes(test.motif)) {
      return {
        verdict: 'rouge',
        titre: test.message ?? 'La réponse ne doit pas être écrite en dur.',
        detail: test.message
          ? `Relis la consigne : cette écriture est écartée volontairement.`
          : `Ton programme doit calculer le résultat, pas l'afficher directement.`,
      }
    }
    if (test.type === 'contient' && !code.includes(test.motif)) {
      return {
        verdict: 'rouge',
        titre: `Cet exercice demande d'utiliser « ${test.motif.trim()} ».`,
        detail: `Ta solution fonctionne peut-être, mais elle n'emploie pas ce que l'exercice fait travailler.`,
      }
    }
  }

  // 3. Les tests de contenu. On s'arrête au premier échec.
  let verdictGlobal: Verdict = 'vert'
  let diffBleu: ResultatTest['diff']
  for (const [i, test] of tests.entries()) {
    // executions est alignee 1:1 sur tests par construction (voir la
    // documentation du parametre) : l'acces direct est donc sûr.
    const resultat = evaluerUn(test, executions[i]!, reponseQcm)
    if (resultat.verdict === 'rouge') return resultat
    if (resultat.verdict === 'bleu') {
      verdictGlobal = 'bleu'
      diffBleu = resultat.diff
    }
  }

  if (verdictGlobal === 'bleu') {
    return {
      verdict: 'bleu',
      titre: 'Ta logique est correcte, le format est à ajuster.',
      detail: `L'exercice est validé et la suite est débloquée. Regarde quand même l'écart ci-dessous : au chapitre 2, le format comptera.`,
      diff: diffBleu,
    }
  }
  return VERT
}

function evaluerUn(
  test: Test,
  execution: ResultatExecution,
  reponseQcm: number | undefined,
): ResultatTest {
  switch (test.type) {
    case 'interdit':
    case 'contient':
      return VERT // déjà traités en amont

    case 'qcm':
      return reponseQcm === test.bonneReponse
        ? VERT
        : { verdict: 'rouge', titre: 'Ce n\'est pas la bonne réponse.', detail: 'Relis le code ligne par ligne, dans l\'ordre.' }

    case 'variable': {
      const lue = execution.variables[test.nom]
      if (!lue) {
        return {
          verdict: 'rouge',
          titre: `La variable ${test.nom} n'a pas été créée.`,
          detail: `Vérifie l'orthographe : Python distingue les majuscules des minuscules.`,
        }
      }
      if (test.typeAttendu && lue.type !== test.typeAttendu) {
        return {
          verdict: 'rouge',
          titre: `La variable ${test.nom} devrait contenir ${nommerType(test.typeAttendu)}, pas ${nommerType(lue.type)}.`,
          detail: detailType(test.typeAttendu, lue),
        }
      }
      if (test.valeurAttendue !== undefined && lue.valeur !== test.valeurAttendue) {
        return {
          verdict: 'rouge',
          titre: `La variable ${test.nom} ne contient pas la bonne valeur.`,
          detail: `Attendu : ${test.valeurAttendue} — obtenu : ${lue.valeur}`,
        }
      }
      return VERT
    }

    case 'sortie': {
      const obtenu = execution.stdout.replace(/\s+$/, '')
      const attendu = test.attendu.replace(/\s+$/, '')
      if (obtenu === attendu) {
        return VERT
      }
      const diff = diffCaracteres(rendreVisible(attendu), rendreVisible(obtenu))
      if (!test.exigeExact && normaliser(obtenu) === normaliser(attendu)) {
        return { verdict: 'bleu', titre: 'Format à ajuster.', diff }
      }
      return {
        verdict: 'rouge',
        titre: 'Ton programme n\'affiche pas ce qui est attendu.',
        detail: `Compare les deux sorties caractère par caractère.`,
        diff,
      }
    }

    default: {
      // Garde d'exhaustivité : ajouter un type de Test sans le traiter ici
      // devient une erreur de compilation, pas un undefined silencieux.
      const jamais: never = test
      throw new Error(`Type de test non géré : ${JSON.stringify(jamais)}`)
    }
  }
}

function nommerType(type: string): string {
  const noms: Record<string, string> = {
    int: 'un nombre entier',
    float: 'un nombre à virgule',
    str: 'du texte',
    bool: 'un booléen (True ou False)',
  }
  return noms[type] ?? `un ${type}`
}

function detailType(attendu: string, lue: { valeur: string; type: string }): string {
  if (attendu === 'int' && lue.type === 'str') {
    return `Tu as écrit ${lue.valeur} avec des guillemets — pour Python, c'est du texte. Enlève les guillemets, ou utilise int() si la valeur vient de input().`
  }
  if (attendu === 'str' && lue.type === 'int') {
    return `Un texte s'écrit entre guillemets : "..." .`
  }
  return `Vérifie comment tu as créé cette variable.`
}

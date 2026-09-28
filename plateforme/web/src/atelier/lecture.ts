/**
 * Lire un fichier d'exercice déposé dans l'atelier.
 *
 * C'est la seule façon de reprendre un exercice déjà écrit : ==les solutions
 * ne sont jamais publiées==, donc rien d'utile ne peut venir de `/contenu/`.
 *
 * L'analyse passe par la bibliothèque `yaml`, pas par un analyseur maison.
 * Un sous-ensemble écrit ici accepterait des fichiers que la construction
 * refuse, et l'atelier dirait « tout va bien » sur un contenu qui casse le
 * déploiement — un outil de vérification qui diverge de la vérification est
 * pire que pas d'outil. C'est l'unique dépendance de l'atelier, assumée dans
 * ADR-015.
 */

import { parseDocument, visit } from 'yaml'
import { BROUILLON_VIDE, type Brouillon } from './brouillon'
import type { Test } from '../validation/types'

/** Ce qu'un fichier d'exercice a le droit de porter. */
const CHAMPS_CONNUS = new Set([
  'id',
  'concept',
  'notion',
  'seance',
  'niveau',
  'type',
  'titre',
  'obligatoire',
  'enonce',
  'depart',
  'indices',
  'tests',
  'solution',
  'expert',
])

const CHAMPS_DE_TEST: Record<string, Set<string>> = {
  sortie: new Set(['type', 'entrees', 'attendu', 'exige_exact']),
  variable: new Set(['type', 'nom', 'valeur_attendue', 'type_attendu']),
  qcm: new Set(['type', 'options', 'bonne_reponse']),
  interdit: new Set(['type', 'motif', 'message']),
  contient: new Set(['type', 'motif', 'message', 'maitrise']),
}

const REQUIS = ['id', 'concept', 'notion', 'seance', 'niveau', 'type', 'titre', 'enonce', 'tests', 'solution']

export class FichierRefuse extends Error {
  constructor(public readonly raisons: string[]) {
    super(raisons.join(' '))
    this.name = 'FichierRefuse'
  }
}

function enTest(brut: Record<string, unknown>, rang: number): Test {
  const sorte = String(brut.type ?? '')
  const connus = CHAMPS_DE_TEST[sorte]
  if (!connus) throw new FichierRefuse([`le test ${rang + 1} a un type inconnu : « ${sorte} ».`])

  const inconnus = Object.keys(brut).filter((cle) => !connus.has(cle))
  if (inconnus.length > 0) {
    throw new FichierRefuse([`le test ${rang + 1} porte un champ inconnu : ${inconnus.join(', ')}.`])
  }

  if (sorte === 'sortie') {
    return {
      type: 'sortie',
      entrees: (brut.entrees as string[]) ?? [],
      attendu: String(brut.attendu ?? ''),
      ...(brut.exige_exact ? { exigeExact: true } : {}),
    }
  }
  if (sorte === 'variable') {
    return {
      type: 'variable',
      nom: String(brut.nom ?? ''),
      ...(brut.valeur_attendue !== undefined
        ? { valeurAttendue: String(brut.valeur_attendue) }
        : {}),
      ...(brut.type_attendu !== undefined ? { typeAttendu: String(brut.type_attendu) } : {}),
    }
  }
  if (sorte === 'qcm') {
    return {
      type: 'qcm',
      options: ((brut.options as unknown[]) ?? []).map(String),
      bonneReponse: Number(brut.bonne_reponse ?? 0),
    }
  }
  return {
    type: sorte as 'interdit' | 'contient',
    motif: String(brut.motif ?? ''),
    ...(brut.message !== undefined ? { message: String(brut.message) } : {}),
    ...(sorte === 'contient' && brut.maitrise ? { maitrise: true } : {}),
  }
}

/**
 * Le texte d'un fichier devient un brouillon, ou le refus dit pourquoi.
 *
 * Un champ inconnu fait **refuser** le fichier plutôt que d'être ignoré. Le
 * formulaire ne connaît que les champs du modèle : le charger en ignorant le
 * reste perdrait ce qu'il ne comprend pas ==au premier export==, sans un mot.
 */
export function lireExercice(texte: string): Brouillon {
  // `parseDocument` ne lève pas : il collecte ses erreurs, ce qui donne accès
  // à leur position. Un message qui nomme la ligne fait gagner la minute
  // qu'on passerait à la chercher.
  const document = parseDocument(texte)
  const premiere = document.errors[0]
  if (premiere) {
    const ligne = premiere.linePos?.[0]?.line
    throw new FichierRefuse([
      // `linePos` est typé facultatif par la bibliothèque, mais
      // `parseDocument` le remplit toujours : la branche sans ligne est une
      // garde que TypeScript exige, pas un cas qui se produit.
      /* v8 ignore next */
      ligne ? `ce n'est pas du YAML valide (ligne ${ligne}).` : "ce n'est pas du YAML valide.",
    ])
  }
  const brut: unknown = document.toJS()

  if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) {
    throw new FichierRefuse(["ce fichier ne décrit pas un exercice."])
  }
  const donnees = brut as Record<string, unknown>

  const inconnus = Object.keys(donnees).filter((cle) => !CHAMPS_CONNUS.has(cle))
  if (inconnus.length > 0) {
    throw new FichierRefuse([
      `champ inconnu : ${inconnus.join(', ')}. L'atelier le perdrait à l'export.`,
    ])
  }

  const manquants = REQUIS.filter((cle) => donnees[cle] === undefined)
  if (manquants.length > 0) {
    throw new FichierRefuse([`il manque ${manquants.join(', ')}.`])
  }

  return {
    ...BROUILLON_VIDE,
    id: String(donnees.id),
    concept: String(donnees.concept),
    notion: String(donnees.notion),
    seance: Number(donnees.seance),
    niveau: donnees.niveau as Brouillon['niveau'],
    type: donnees.type as Brouillon['type'],
    titre: String(donnees.titre),
    obligatoire: donnees.obligatoire !== false,
    enonce: String(donnees.enonce),
    depart: donnees.depart === undefined ? '' : String(donnees.depart),
    indices: ((donnees.indices as unknown[]) ?? []).map(String),
    tests: (donnees.tests as Record<string, unknown>[]).map(enTest),
    solution: String(donnees.solution),
    ...(donnees.expert !== undefined ? { expert: String(donnees.expert) } : {}),
  }
}


/**
 * Le fichier porte-t-il des commentaires ?
 *
 * L'atelier ne les rend pas : il relit les données, pas la mise en page. Or
 * quinze des 112 fichiers du dépôt en portent, et ils expliquent un choix
 * pédagogique — pourquoi tel exercice n'a ni sortie ni valeur attendue, par
 * exemple. ==Les perdre en silence serait la pire des pertes== : personne ne
 * relit un diff pour vérifier qu'un commentaire est encore là.
 *
 * On le détecte donc, et on le dit avant que le professeur n'exporte.
 */
export function porteDesCommentaires(texte: string): boolean {
  const document = parseDocument(texte)
  if (document.comment || document.commentBefore) return true

  let trouve = false
  visit(document, (_, noeud) => {
    const avec = noeud as { comment?: string | null; commentBefore?: string | null }
    if (avec?.comment || avec?.commentBefore) {
      trouve = true
      return visit.BREAK
    }
    return undefined
  })
  return trouve
}

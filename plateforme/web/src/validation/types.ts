export type Verdict = 'vert' | 'bleu' | 'rouge'

export type SegmentDiff = {
  /** `ajout` = présent chez l'élève et pas attendu ; `manque` = attendu et absent */
  type: 'egal' | 'ajout' | 'manque'
  texte: string
}

export type Test =
  | { type: 'sortie'; entrees: string[]; attendu: string; exigeExact?: boolean }
  | { type: 'variable'; nom: string; valeurAttendue?: string; typeAttendu?: string }
  | { type: 'qcm'; options: string[]; bonneReponse: number }
  | { type: 'interdit'; motif: string; message?: string }
  | { type: 'contient'; motif: string; message?: string; maitrise?: boolean }

/**
 * Trois niveaux de réussite, tels que l'élève les voit :
 *
 * | | |
 * |---|---|
 * | 0 | ça ne marche pas encore |
 * | 1 | ça marche |
 * | 2 | ça marche, et de la bonne façon |
 *
 * Le passage de 1 à 2 se joue sur deux choses : la sortie est exacte sans
 * qu'on ait eu à la normaliser, et les critères de maîtrise de l'exercice —
 * quand il en déclare — sont satisfaits.
 */
export type ResultatTest = {
  verdict: Verdict
  /** Phrase affichée à l'élève, toujours en français */
  titre: string
  detail?: string
  diff?: SegmentDiff[]
}

/**
 * Un exercice déjà validé, tel que l'API le rend.
 *
 * `le` est la date de la PREMIÈRE réussite — celle que l'élève reconnaît,
 * « je l'avais fait mercredi ». `verdict` est le MEILLEUR obtenu : rejouer
 * moins bien ne retire pas une coche déjà gagnée.
 */
export type Reussite = {
  exerciceId: string
  verdict: Verdict
  le: string
}

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
  | { type: 'interdit'; motif: string }
  | { type: 'contient'; motif: string }

export type ResultatTest = {
  verdict: Verdict
  /** Phrase affichée à l'élève, toujours en français */
  titre: string
  detail?: string
  diff?: SegmentDiff[]
}

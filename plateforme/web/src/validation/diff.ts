import type { SegmentDiff } from './types'

/**
 * Diff caractere par caractere par plus longue sous-sequence commune.
 * Les sorties comparees font quelques centaines de caracteres au maximum :
 * l'algorithme quadratique est largement suffisant et reste lisible.
 */
export function diffCaracteres(attendu: string, obtenu: string): SegmentDiff[] {
  const n = attendu.length
  const m = obtenu.length
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] =
        attendu[i] === obtenu[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }

  const segments: SegmentDiff[] = []
  const pousser = (type: SegmentDiff['type'], c: string) => {
    const dernier = segments[segments.length - 1]
    if (dernier && dernier.type === type) dernier.texte += c
    else segments.push({ type, texte: c })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (attendu[i] === obtenu[j]) {
      pousser('egal', attendu[i]!)
      i++
      j++
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      pousser('manque', attendu[i]!)
      i++
    } else {
      pousser('ajout', obtenu[j]!)
      j++
    }
  }
  while (i < n) pousser('manque', attendu[i++]!)
  while (j < m) pousser('ajout', obtenu[j++]!)

  return segments
}

/** Rend visibles les caracteres invisibles, pour que l'eleve voie l'espace en trop. */
export function rendreVisible(texte: string): string {
  return texte.replace(/ /g, '·').replace(/\n/g, '⏎\n')
}

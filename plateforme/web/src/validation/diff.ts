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

/**
 * Le surlignage vaut-il la peine d'être montré ?
 *
 * Sur deux sorties voisines, il désigne exactement le caractère fautif. Sur
 * deux textes qui n'ont rien à voir — « banane » face à « Bonjour tout le
 * monde » — la plus longue sous-séquence commune n'est qu'un semis de lettres
 * isolées, et le surlignage découpe les deux lignes en confettis. Il faut donc
 * qu'au moins ==trois dixièmes== de la plus longue des deux sorties soient
 * communs pour que marquer le reste apprenne quoi que ce soit.
 */
export function diffInformatif(segments: SegmentDiff[]): boolean {
  let communs = 0
  let attendu = 0
  let obtenu = 0
  for (const segment of segments) {
    const taille = segment.texte.length
    if (segment.type !== 'ajout') attendu += taille
    if (segment.type !== 'manque') obtenu += taille
    if (segment.type === 'egal') communs += taille
  }
  const plusLong = Math.max(attendu, obtenu)
  return plusLong > 0 && communs / plusLong >= 0.3
}

/** Rend visibles les caracteres invisibles, pour que l'eleve voie l'espace en trop. */
export function rendreVisible(texte: string): string {
  return texte.replace(/ /g, '·').replace(/\n/g, '⏎\n')
}

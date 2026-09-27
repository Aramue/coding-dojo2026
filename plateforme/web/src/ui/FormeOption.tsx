/**
 * Les quatre formes des options du quiz, tracées à la main.
 *
 * La couleur ne parle jamais seule : un élève qui ne distingue pas le violet
 * du bleu lit un triangle et un cercle. Et pas de glyphe Unicode — son dessin
 * change d'une machine à l'autre. Voir la Charte visuelle, amendement du
 * 27 septembre 2026.
 */

export const LETTRES = ['A', 'B', 'C', 'D'] as const

export function FormeOption({ rang }: { rang: number }) {
  return (
    <svg className="forme-option" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      {rang === 0 && <path d="M11 3 L20 19 H2 Z" />}
      {rang === 1 && <path d="M11 2 L20 11 L11 20 L2 11 Z" />}
      {rang === 2 && <circle cx="11" cy="11" r="8.5" />}
      {rang === 3 && <rect x="3" y="3" width="16" height="16" rx="2" />}
    </svg>
  )
}

/** La coche de la bonne réponse. Tracée, elle aussi : jamais le caractère ✓. */
export function Coche() {
  return (
    <svg className="coche" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4 10.5 L8.2 14.5 L16 5.5" />
    </svg>
  )
}

import type { ReactNode } from 'react'

// Deux marques, pas davantage : **gras** et `code`. Le contenu vient de nos
// propres fichiers YAML, mais on n'injecte jamais de HTML — React échappe
// chaque fragment de texte, donc une balise écrite dans une leçon s'affiche
// telle quelle au lieu de s'exécuter.
//
// Le groupe capturant est délibéré : `split` avec une expression capturante
// garde les séparateurs dans le tableau, ce qui permet de les reconnaître au
// lieu de les perdre.
const MARQUES = /(\*\*[^*]+\*\*|`[^`]+`)/g

export function formaterTexte(texte: string): ReactNode[] {
  return texte
    .split(MARQUES)
    .filter((fragment) => fragment !== '')
    .map((fragment, index) => {
      if (fragment.startsWith('**') && fragment.endsWith('**')) {
        return <strong key={index}>{fragment.slice(2, -2)}</strong>
      }
      if (fragment.startsWith('`') && fragment.endsWith('`') && fragment.length > 1) {
        return (
          <code key={index} className="mono">
            {fragment.slice(1, -1)}
          </code>
        )
      }
      return fragment
    })
}

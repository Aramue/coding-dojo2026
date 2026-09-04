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

/**
 * Un énoncé est du texte brut, écrit en YAML avec des retours à la ligne. Deux
 * sortes de retours s'y mélangent :
 *
 * - ceux de la mise en page de l'auteur, qui coupe ses phrases vers 75
 *   colonnes pour que le fichier reste lisible — ils ne veulent rien dire ;
 * - ceux qui portent du sens : une sortie attendue ligne par ligne, une liste
 *   de consignes numérotées, un message d'erreur.
 *
 * Les rendre tous tels quels (`white-space: pre-line`) coupait les phrases à
 * une largeur qui n'a aucun rapport avec celle de l'écran de l'élève. Les
 * supprimer tous écraserait les sorties attendues sur une seule ligne.
 *
 * D'où trois genres de bloc, reconnus à leur forme.
 */
const LARGEUR_SORTIE = 46
const MOTIF_LISTE = /^\s*(?:[0-9]+[.)]|[-•])\s/

/** Ce qu'un bloc d'énoncé est, et donc comment il se rend. */
export type GenreBloc =
  /** Prose : les retours du fichier ne veulent rien dire, le navigateur réenroule. */
  | 'paragraphe'
  /** Consignes numérotées : les retours comptent, mais ça reste de la prose. */
  | 'liste'
  /** Sortie attendue ou message d'erreur : chasse fixe, au caractère près. */
  | 'sortie'

export function genreDuBloc(paragraphe: string): GenreBloc {
  const lignes = paragraphe.split('\n')
  if (lignes.length === 1) return 'paragraphe'
  if (lignes.some((ligne) => MOTIF_LISTE.test(ligne))) return 'liste'
  if (lignes.every((ligne) => ligne.trim().length <= LARGEUR_SORTIE)) return 'sortie'
  return 'paragraphe'
}

export function decouperEnonce(enonce: string): { texte: string; genre: GenreBloc }[] {
  return enonce
    .trim()
    .split(/\n[ \t]*\n/)
    .map((bloc) =>
      bloc
        .split('\n')
        .map((ligne) => ligne.trim())
        .join('\n'),
    )
    .filter((bloc) => bloc !== '')
    .map((bloc) => {
      const genre = genreDuBloc(bloc)
      return { genre, texte: genre === 'paragraphe' ? bloc.replace(/\n/g, ' ') : bloc }
    })
}

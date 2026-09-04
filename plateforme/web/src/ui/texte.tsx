import type { ReactNode } from 'react'

// Trois marques, pas davantage : **gras**, *italique* et `code`. Le contenu
// vient de nos propres fichiers YAML, mais on n'injecte jamais de HTML — React
// échappe chaque fragment de texte, donc une balise écrite dans une leçon
// s'affiche telle quelle au lieu de s'exécuter.
//
// Le groupe capturant est délibéré : `split` avec une expression capturante
// garde les séparateurs dans le tableau, ce qui permet de les reconnaître au
// lieu de les perdre.
//
// L'italique exige un caractère NON blanc juste après l'astérisque ouvrante :
// sans cette garde, « 2 * 3 et 4 * 5 » deviendrait « 2  3 et 4  5 » en
// italique.
const MARQUES = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g

export function formaterTexte(texte: string): ReactNode[] {
  return texte
    .split(MARQUES)
    .filter((fragment) => fragment !== '')
    .map((fragment, index) => {
      // Recursif : `**le signe `+`**` doit rendre le code A L'INTERIEUR du
      // gras. Sans cet appel, les accents graves s'affichaient tels quels au
      // milieu de la phrase.
      if (fragment.startsWith('**') && fragment.endsWith('**')) {
        return <strong key={index}>{formaterTexte(fragment.slice(2, -2))}</strong>
      }
      if (fragment.startsWith('`') && fragment.endsWith('`') && fragment.length > 1) {
        return (
          <code key={index} className="mono">
            {fragment.slice(1, -1)}
          </code>
        )
      }
      if (fragment.startsWith('*') && fragment.endsWith('*') && fragment.length > 2) {
        return <em key={index}>{formaterTexte(fragment.slice(1, -1))}</em>
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

/**
 * Un bloc d'une seule ligne est ambigu : « La séance commence » a exactement la
 * forme d'une phrase. C'est son ANNONCE qui le trahit — tous les énoncés
 * l'introduisent par un deux-points (« il devait afficher exactement cette
 * ligne : », « Python affiche ce message d'erreur : »).
 *
 * Sans ce signal, la sortie attendue d'un exercice `debug` s'affichait comme de
 * la prose, alors que l'élève doit la reproduire au caractère près.
 */
function estAnnonce(bloc: string | undefined): boolean {
  return bloc !== undefined && /:\s*$/.test(bloc)
}

export function genreDuBloc(paragraphe: string, precedent?: string): GenreBloc {
  const lignes = paragraphe.split('\n')
  if (lignes.length === 1) {
    return estAnnonce(precedent) ? 'sortie' : 'paragraphe'
  }
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
    .map((bloc, index, blocs) => {
      const genre = genreDuBloc(bloc, blocs[index - 1])
      return { genre, texte: genre === 'paragraphe' ? bloc.replace(/\n/g, ' ') : bloc }
    })
}

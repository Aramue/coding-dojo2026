import type { MouseEvent, ReactNode } from 'react'
import { naviguer, versChemin, type Destination } from '../routage'
import './PiedNavigation.css'

/**
 * L'étape d'avant et l'étape d'après, en bas de chaque page.
 *
 * Sans elles, toutes les pages étaient des culs-de-sac : le cours s'arrêtait,
 * un exercice n'avait ni précédent ni suivant, et il fallait repasser par le
 * menu à chaque fois. ==Un parcours d'apprentissage est un chemin== — il doit
 * se lire comme tel.
 */
export type Etape = {
  cible: Destination
  libelle: string
}

export function PiedNavigation({
  precedent,
  suivant,
  sombre = false,
}: {
  precedent?: Etape
  suivant?: Etape
  /** L'écran d'exercice est sur fond sombre : le pied s'y adapte. */
  sombre?: boolean
}) {
  if (!precedent && !suivant) return null

  return (
    <nav
      className={'pied' + (sombre ? ' pied--sombre' : '')}
      aria-label="Étape précédente et suivante"
    >
      {precedent ? <Etape etape={precedent} sens="precedent" /> : <span />}
      {suivant && <Etape etape={suivant} sens="suivant" />}
    </nav>
  )
}

function Etape({ etape, sens }: { etape: Etape; sens: 'precedent' | 'suivant' }) {
  const chemin = versChemin(etape.cible)

  function cliquer(evenement: MouseEvent<HTMLAnchorElement>) {
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) return
    evenement.preventDefault()
    naviguer(etape.cible)
    // Une nouvelle page commence en haut : sans cela, l'élève arrive au milieu
    // du texte suivant, à la hauteur où il avait laissé le précédent.
    scrollTo({ top: 0 })
  }

  return (
    <a className={`pied__lien pied__lien--${sens}`} href={chemin} onClick={cliquer}>
      {sens === 'precedent' && <Fleche sens="gauche" />}
      <span className="pied__texte">
        <span className="pied__sens">{sens === 'precedent' ? 'Précédent' : 'Suivant'}</span>
        <span className="pied__libelle">{etape.libelle}</span>
      </span>
      {sens === 'suivant' && <Fleche sens="droite" />}
    </a>
  )
}

/** SVG tracé à la main, trait 1,8 : la charte interdit emoji et icônes importées. */
function Fleche({ sens }: { sens: 'gauche' | 'droite' }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d={sens === 'droite' ? 'M5 12h13M13 6l6 6-6 6' : 'M19 12H6M11 6l-6 6 6 6'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

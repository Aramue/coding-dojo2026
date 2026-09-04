import type { Reussite } from '../validation/types'
import './RappelReussite.css'

/**
 * Formate la date en français de Suisse : « 16 septembre 2026 à 14:32 ».
 *
 * Renvoie null sur une date que le navigateur ne sait pas lire — mieux vaut
 * un rappel sans date qu'un « Invalid Date » affiché à l'élève.
 */
export function formaterDate(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

/**
 * Ce que l'élève lit en revenant sur un exercice qu'il a déjà validé.
 *
 * Deux choses à dire, et pas une de plus : quand il l'a réussi, et avec
 * quelle mention. La mention n'est pas décorative — c'est elle qui montre
 * qu'il reste une coche à décrocher, sur un exercice qui a l'air fini.
 */
export function RappelReussite({ reussite }: { reussite: Reussite }) {
  const maitrise = reussite.verdict === 'vert'
  const quand = formaterDate(reussite.le)

  return (
    <aside className="rappel" data-niveau={maitrise ? 2 : 1}>
      <span className="rappel__coches" aria-hidden="true">
        <Coche />
        {maitrise && <Coche />}
      </span>
      <p className="rappel__texte">
        <b className="rappel__mention">
          {maitrise ? 'Réussi, méthode maîtrisée' : 'Réussi'}
        </b>
        <span>
          {quand ? `Validé le ${quand}. ` : 'Déjà validé. '}
          {maitrise
            ? 'Rien à ajouter — tu peux le refaire pour t’entraîner, ça ne t’enlèvera rien.'
            : 'Il te reste une coche : refais-le avec la méthode que la leçon fait travailler.'}
        </span>
      </p>
    </aside>
  )
}

function Coche() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

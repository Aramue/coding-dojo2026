import type { MouseEvent } from 'react'
import type { GroupeNotion } from '../contenu/notions'
import type { Exercice } from '../contenu/types'
import { naviguer, versChemin } from '../routage'
import './PageExercices.css'

/** Le nom du type d'exercice, en français, tel que l'élève le lit. */
const TYPES: Record<Exercice['type'], string> = {
  predire: 'À lire',
  debug: 'À corriger',
  completer: 'À compléter',
  ecrire: 'À écrire',
}

export function PageExercices({
  groupe,
  reussis,
}: {
  groupe: GroupeNotion
  reussis: string[]
}) {
  const acquis = new Set(reussis)

  return (
    <main className="exercices" data-famille={groupe.famille}>
      <header className="exercices__entete">
        <h1>{groupe.titre}</h1>
        <p className="exercices__avancement">
          {groupe.faits} / {groupe.exercices.length}
        </p>
      </header>

      {groupe.exercices.length === 0 ? (
        <p className="exercices__vide">Il n'y a pas encore d'exercice pour cette notion.</p>
      ) : (
        <ol className="exercices__liste">
          {groupe.exercices.map((exercice, index) => {
            const cible = { vue: 'exercice' as const, notion: groupe.id, numero: index + 1 }
            const fait = acquis.has(exercice.id)
            return (
              <li
                key={exercice.id}
                className="exercices__ligne"
                data-etat={fait ? 'reussi' : 'a-faire'}
              >
                <span className="exercices__rang" aria-hidden="true">
                  {fait ? <Coche /> : index + 1}
                </span>
                <a
                  className="exercices__lien"
                  href={versChemin(cible)}
                  onClick={(evenement: MouseEvent<HTMLAnchorElement>) => {
                    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) return
                    evenement.preventDefault()
                    naviguer(cible)
                  }}
                >
                  {exercice.titre}
                </a>
                <span className="exercices__type">{TYPES[exercice.type]}</span>
                <span className="sr-only">{fait ? 'réussi' : 'à faire'}</span>
              </li>
            )
          })}
        </ol>
      )}
    </main>
  )
}

/** SVG tracé à la main, trait 1,8 : la charte interdit emoji et icônes importées. */
function Coche() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

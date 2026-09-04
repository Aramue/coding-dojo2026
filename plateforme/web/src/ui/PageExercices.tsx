import type { MouseEvent } from 'react'
import type { GroupeNotion } from '../contenu/notions'
import type { Exercice } from '../contenu/types'
import { naviguer, versChemin } from '../routage'
import { PiedNavigation } from './PiedNavigation'
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
  suivante,
}: {
  groupe: GroupeNotion
  reussis: string[]
  /** La notion d'après, pour ne pas laisser l'élève sans étape suivante. */
  suivante?: GroupeNotion
}) {
  const acquis = new Set(reussis)
  const termine = groupe.total > 0 && groupe.faits === groupe.total

  // L'index dans `exercices` est le numéro de l'URL : il court sur TOUS les
  // exercices, bonus compris. Le numéro affiché, lui, court sur le groupe
  // affiché — l'élève ne tape jamais l'URL, il clique.
  const avecRang = groupe.exercices.map((exercice, index) => ({ exercice, numero: index + 1 }))
  const obligatoires = avecRang.filter(({ exercice }) => exercice.obligatoire)
  const enPlus = avecRang.filter(({ exercice }) => !exercice.obligatoire)

  return (
    <main className="page" data-famille={groupe.famille}>
      <header className="page__entete">
        <p className="page__notion">{groupe.titre}</p>
        <h1 className="page__titre">Exercices</h1>
        <p className="page__meta">
          <span className="exercices__avancement">
            {groupe.faits} / {groupe.total}
          </span>{' '}
          réussis
        </p>
      </header>

      <div className="page__corps">
        {groupe.exercices.length === 0 ? (
          <p className="exercices__vide carte">
            Il n'y a pas encore d'exercice pour cette notion.
          </p>
        ) : (
          <>
            <Liste
              exercices={obligatoires}
              notion={groupe.id}
              acquis={acquis}
              numerote
            />

            {enPlus.length > 0 && (
              <section className="exercices__bonus">
                <h2 className="exercices__soustitre">Pour aller plus loin</h2>
                <p className="exercices__note">
                  Facultatifs. Ils ne comptent pas dans ta progression — ils sont là si tu veux
                  creuser, ou t'entraîner davantage.
                </p>
                <Liste exercices={enPlus} notion={groupe.id} acquis={acquis} />
              </section>
            )}
          </>
        )}
      </div>

      <PiedNavigation
        precedent={
          groupe.lecon
            ? { cible: { vue: 'cours', notion: groupe.id }, libelle: groupe.lecon.titre }
            : undefined
        }
        suivant={
          termine && suivante
            ? { cible: { vue: 'cours', notion: suivante.id }, libelle: suivante.titre }
            : undefined
        }
      />
    </main>
  )
}

function Liste({
  exercices,
  notion,
  acquis,
  numerote = false,
}: {
  exercices: { exercice: Exercice; numero: number }[]
  notion: string
  acquis: Set<string>
  numerote?: boolean
}) {
  if (exercices.length === 0) return null

  return (
    <ol className="exercices__liste carte">
      {exercices.map(({ exercice, numero }, rang) => {
        const cible = { vue: 'exercice' as const, notion, numero }
        const fait = acquis.has(exercice.id)
        return (
          <li key={exercice.id} className="exercices__ligne" data-etat={fait ? 'reussi' : 'a-faire'}>
            <span className="exercices__rang" aria-hidden="true">
              {fait ? <Coche /> : numerote ? rang + 1 : <Point />}
            </span>
            <a
              className="exercices__lien"
              href={versChemin(cible)}
              onClick={(evenement: MouseEvent<HTMLAnchorElement>) => {
                if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) return
                evenement.preventDefault()
                naviguer(cible)
                scrollTo({ top: 0 })
              }}
            >
              {exercice.titre}
            </a>
            {exercice.niveau === 'expert' && <span className="etiquette">Bonus</span>}
            <span className="exercices__type">{TYPES[exercice.type]}</span>
            <span className="sr-only">{fait ? 'réussi' : 'à faire'}</span>
            <Chevron />
          </li>
        )
      })}
    </ol>
  )
}

/* SVG tracés à la main, trait 1,8 : la charte interdit emoji et icônes importées. */

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

/** Les facultatifs ne sont pas numérotés : ils ne forment pas une suite à tenir. */
function Point() {
  return (
    <svg viewBox="0 0 24 24" width="8" height="8" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg
      className="exercices__chevron"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

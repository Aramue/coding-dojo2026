import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import type { GroupeChapitre, GroupeNotion } from '../contenu/notions'
import { naviguer, versChemin, type Destination } from '../routage'
import './Menu.css'

/**
 * Le sommaire du cours : partie, chapitres dépliants, et sous chaque notion
 * ses deux pages. C'est la carte du parcours — depuis n'importe où, l'élève
 * atteint n'importe quelle page et voit où il en est.
 */
export function Menu({
  chapitres,
  destination,
}: {
  chapitres: GroupeChapitre[]
  destination: Destination
}) {
  return (
    <nav className="menu" aria-label="Sommaire du cours">
      {chapitres.map((chapitre) => (
        <Chapitre key={chapitre.id} chapitre={chapitre} destination={destination} />
      ))}
    </nav>
  )
}

function Chapitre({
  chapitre,
  destination,
}: {
  chapitre: GroupeChapitre
  destination: Destination
}) {
  const contientLaPageCourante = chapitre.notions.some(
    (n) => 'notion' in destination && destination.notion === n.id,
  )
  const [ouvert, setOuvert] = useState(true)

  // Naviguer vers une notion d'un chapitre replié le rouvre : sinon la page
  // courante n'apparaît nulle part dans le sommaire.
  useEffect(() => {
    if (contientLaPageCourante) setOuvert(true)
  }, [contientLaPageCourante])

  const pourcent = chapitre.total === 0 ? 0 : (chapitre.faits / chapitre.total) * 100

  return (
    <section className="chapitre">
      <button
        type="button"
        className="chapitre__tete"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
      >
        <Chevron ouvert={ouvert} />
        <span className="chapitre__titre">{chapitre.titre}</span>
        <span className="chapitre__compte">
          {chapitre.faits}/{chapitre.total}
        </span>
      </button>

      <div className="chapitre__jauge" aria-hidden="true">
        <span style={{ width: `${pourcent}%` }} />
      </div>

      <div className="chapitre__corps" data-ouvert={ouvert}>
        <ol className="chapitre__notions">
          {chapitre.notions.map((notion, rang) => (
            <Notion key={notion.id} notion={notion} rang={rang + 1} destination={destination} />
          ))}
        </ol>
      </div>
    </section>
  )
}

function Notion({
  notion,
  rang,
  destination,
}: {
  notion: GroupeNotion
  rang: number
  destination: Destination
}) {
  const courante = 'notion' in destination && destination.notion === notion.id
  const [ouverte, setOuverte] = useState(courante)

  useEffect(() => {
    if (courante) setOuverte(true)
  }, [courante])

  const total = notion.exercices.length
  const terminee = total > 0 && notion.faits === total

  return (
    <li
      className={'notion' + (courante ? ' notion--courante' : '')}
      data-famille={notion.famille}
    >
      <button
        type="button"
        className="notion__tete"
        aria-expanded={ouverte}
        onClick={() => setOuverte((o) => !o)}
      >
        <span className="notion__rang" aria-hidden="true">
          {terminee ? <Coche /> : rang}
        </span>
        <span className="notion__titre">{notion.titre}</span>
        <span className="notion__compte">
          {notion.faits}/{total}
        </span>
      </button>

      <div className="notion__corps" data-ouvert={ouverte}>
        <div className="notion__liens">
          <Lien cible={{ vue: 'cours', notion: notion.id }} destination={destination}>
            Cours
          </Lien>
          <Lien cible={{ vue: 'exercices', notion: notion.id }} destination={destination}>
            Exercices
          </Lien>
        </div>
      </div>
    </li>
  )
}

/** Un exercice ouvert appartient à la liste d'exercices de sa notion. */
function memeEndroit(cible: Destination, destination: Destination): boolean {
  if (
    cible.vue === 'exercices' &&
    destination.vue === 'exercice' &&
    destination.notion === cible.notion
  ) {
    return true
  }
  return versChemin(cible) === versChemin(destination)
}

/**
 * Un vrai `<a href>` : il s'ouvre dans un nouvel onglet au clic du milieu, se
 * copie, s'annonce au lecteur d'écran. Le `preventDefault` n'intercepte que le
 * clic simple, pour éviter le rechargement complet.
 */
function Lien({
  cible,
  destination,
  children,
}: {
  cible: Destination
  destination: Destination
  children: ReactNode
}) {
  const chemin = versChemin(cible)

  function cliquer(evenement: MouseEvent<HTMLAnchorElement>) {
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) return
    evenement.preventDefault()
    naviguer(cible)
    scrollTo({ top: 0 })
  }

  return (
    <a
      className="menu__lien"
      href={chemin}
      onClick={cliquer}
      aria-current={memeEndroit(cible, destination) ? 'page' : undefined}
    >
      {children}
    </a>
  )
}

/* SVG tracés à la main, trait 1,8 : la charte interdit emoji et icônes importées. */

function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      className={'chevron' + (ouvert ? ' chevron--ouvert' : '')}
      viewBox="0 0 24 24"
      width="14"
      height="14"
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

function Coche() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
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

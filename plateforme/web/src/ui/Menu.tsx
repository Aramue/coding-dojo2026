import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import type { GroupeChapitre, GroupeNotion } from '../contenu/notions'
import { naviguer, versChemin, type Destination } from '../routage'
import './Menu.css'

/**
 * Le sommaire du cours : partie, chapitres dépliants, et sous chaque notion
 * ses deux pages. C'est la carte du parcours — depuis n'importe où, l'élève
 * atteint n'importe quelle page et voit où il en est.
 */
/** Où en est le quiz, pour l'entrée du sommaire. */
export type QuizDuMenu = { ouvert: boolean; titre?: string }

export function Menu({
  chapitres,
  destination,
  quiz = { ouvert: false },
  verrouille = false,
}: {
  chapitres: GroupeChapitre[]
  destination: Destination
  quiz?: QuizDuMenu
  /**
   * Pendant une partie, TOUS les chapitres se ferment — y compris ceux qu'on
   * ajoutera : le verrou porte sur le cours entier, pas sur une liste. Seule
   * l'entrée du quiz, qui n'est pas un chapitre, reste ouverte.
   */
  verrouille?: boolean
}) {
  return (
    <nav className="menu" aria-label="Sommaire du cours">
      <EntreeQuiz quiz={quiz} destination={destination} />
      {verrouille && (
        <p className="menu__ferme">
          <Cadenas />
          Le cours est fermé pendant le quiz.
        </p>
      )}
      <div className="menu__cours" inert={verrouille} data-verrouille={verrouille || undefined}>
        {chapitres.map((chapitre) => (
          <Chapitre key={chapitre.id} chapitre={chapitre} destination={destination} />
        ))}
      </div>
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

  // `total` compte les OBLIGATOIRES : un bonus ne fait pas partie du chemin.
  const total = notion.total
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

/**
 * Le quiz, tout en haut du sommaire, toujours à la même place.
 *
 * Grisé tant qu'aucune partie n'est ouverte : l'élève sait qu'il existe et où
 * il apparaîtra, sans pouvoir ouvrir une page vide. Dès que le professeur
 * crée une partie, l'entrée s'allume — en même temps que le bandeau.
 */
function EntreeQuiz({ quiz, destination }: { quiz: QuizDuMenu; destination: Destination }) {
  const ici = destination.vue === 'quiz'
  const contenu = (
    <>
      <Chrono />
      <span className="menu-quiz__texte">
        <span className="menu-quiz__titre">Quiz en direct</span>
        <span className="menu-quiz__etat">
          {quiz.ouvert ? (quiz.titre ?? 'Partie en cours') : ici ? 'Aucune partie' : 'Pas de quiz lancé'}
        </span>
      </span>
      {quiz.ouvert && <span className="menu-quiz__direct" aria-hidden="true" />}
    </>
  )

  if (!quiz.ouvert && !ici) {
    return (
      <div className="menu-quiz" aria-disabled="true">
        {contenu}
      </div>
    )
  }
  return (
    <Lien cible={{ vue: 'quiz' }} destination={destination} className="menu-quiz">
      {contenu}
    </Lien>
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
  className = 'menu__lien',
}: {
  cible: Destination
  destination: Destination
  children: ReactNode
  className?: string
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
      className={className}
      href={chemin}
      onClick={cliquer}
      aria-current={memeEndroit(cible, destination) ? 'page' : undefined}
    >
      {children}
    </a>
  )
}

/* SVG tracés à la main, trait 1,8 : la charte interdit emoji et icônes importées. */

function Cadenas() {
  return (
    <svg className="menu__cadenas" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function Chrono() {
  return (
    <svg className="menu-quiz__icone" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="12" cy="13.5" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 13.5V10M10 3.5h4M12 3.5v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

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

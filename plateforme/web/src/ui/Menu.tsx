import type { MouseEvent, ReactNode } from 'react'
import type { GroupeNotion } from '../contenu/notions'
import { naviguer, versChemin, type Destination } from '../routage'
import './Menu.css'

/**
 * Le menu est permanent : depuis n'importe où, l'élève atteint n'importe quelle
 * page. C'est ce qui manquait — l'application n'affichait que le premier
 * exercice non réussi, sans retour en arrière ni moyen de sauter un blocage.
 */
export function Menu({
  groupes,
  destination,
}: {
  groupes: GroupeNotion[]
  destination: Destination
}) {
  return (
    <nav className="menu" aria-label="Notions de la séance">
      <ol className="menu__liste">
        {groupes.map((groupe) => (
          <li key={groupe.id} className="menu__notion" data-famille={groupe.famille}>
            <span className="menu__pastille" aria-hidden="true" />
            <span className="menu__titre">{groupe.titre}</span>
            <span className="menu__avancement">
              {groupe.faits} / {groupe.exercices.length}
            </span>
            <span className="menu__liens">
              <Lien cible={{ vue: 'cours', notion: groupe.id }} destination={destination}>
                Cours
              </Lien>
              <Lien cible={{ vue: 'exercices', notion: groupe.id }} destination={destination}>
                Exercices
              </Lien>
            </span>
          </li>
        ))}
      </ol>
    </nav>
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

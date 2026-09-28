import type { EtatEleve } from '../quiz/types'
import { naviguer } from '../routage'

/** Le bandeau montre une partie ouverte : pas avant sa création, plus après sa fin. */
export function partieOuverte(etat: EtatEleve | null): etat is Extract<EtatEleve, { partie: number }> {
  return etat !== null && etat.partie !== null && etat.phase !== 'terminee'
}

/**
 * Le bandeau qui invite l'élève dans une partie en cours.
 *
 * C'est la porte d'entrée du quiz : pas de code de partie à recopier, l'élève
 * est déjà connecté et une instance ne sert qu'une classe. Voir ADR-015.
 *
 * Il colle sous l'en-tête pendant le défilement : un élève au milieu d'un long
 * exercice doit le voir sans remonter. Il suit la sonnette de la coquille —
 * il apparaît à la création de la partie et disparaît à sa fin, sans attendre.
 *
 * Il dit aussi pourquoi la page est grisée : hors de /quiz, pendant une partie,
 * tout le cours est fermé. Un panneau au milieu de la page le disait avec un
 * troisième bouton vers le quiz ; le bandeau et l'entrée du sommaire suffisent.
 */
export function BandeauQuiz({ etat }: { etat: EtatEleve | null }) {
  if (!partieOuverte(etat)) return null

  return (
    <div className="bandeau-quiz" role="status">
      <span className="bandeau-quiz__texte">
        <b>{etat.rejoint ? 'Ta partie de quiz continue' : 'Un quiz a commencé'}</b>
        <span> · {etat.titre}</span>
        <span className="bandeau-quiz__ferme">
          Le cours est fermé jusqu'à la fin de la partie ; ta page t'attend telle quelle.
        </span>
      </span>
      <button
        type="button"
        className="bouton bouton--primaire"
        onClick={() => {
          naviguer({ vue: 'quiz' })
          scrollTo({ top: 0 })
        }}
      >
        {etat.rejoint ? 'Revenir au quiz' : 'Rejoindre'}
      </button>
    </div>
  )
}

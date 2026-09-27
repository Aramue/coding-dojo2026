/** Un élève dans la salle d'attente : son nom affiché, et s'il s'agit de soi. */
export type Pastille = { cle: string; nom: string; moi?: boolean }

function initiale(nom: string): string {
  return nom.trim().charAt(0).toUpperCase() || '?'
}

/**
 * Les élèves prêts, un rond chacun, sur l'écran de l'élève comme au mur.
 *
 * Un nombre seul (« 12 élèves prêts ») ne se voit pas grandir ; des ronds qui
 * arrivent un à un, si. Les noms sont les mêmes des deux côtés — « Prénom N. »,
 * jamais un code d'accès. Voir ADR-013.
 */
export function PastillesJoueurs({
  joueurs,
  sur,
  titre = 'Élèves prêts',
}: {
  joueurs: Pastille[]
  /** Le nombre d'inscrits, quand on le connaît : « 4 élèves prêts sur 6 ». */
  sur?: number | null
  titre?: string
}) {
  return (
    <div className="pastilles">
      <p className="pastilles__compte">
        <b>{joueurs.length}</b> {joueurs.length <= 1 ? 'élève prêt' : 'élèves prêts'}
        {sur != null && <> sur {sur}</>}
      </p>
      {joueurs.length > 0 && (
        <ul className="pastilles__liste" aria-label={titre}>
          {joueurs.map((joueur) => (
            <li key={joueur.cle} className="pastille" data-moi={joueur.moi || undefined}>
              <span className="pastille__rond" aria-hidden="true">
                {initiale(joueur.nom)}
              </span>
              <span className="pastille__nom">
                {joueur.nom}
                {joueur.moi && <span className="pastille__toi"> · toi</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

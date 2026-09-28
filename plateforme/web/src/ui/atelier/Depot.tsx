import { useState } from 'react'
import type { EntreeDuDepot } from '../../atelier/depot'

/**
 * Le dossier du dépôt, ouvert une fois pour toute la session.
 *
 * C'est la voie courte pour corriger : on cherche l'exercice par son
 * identifiant ou par son titre, un clic le reprend ==entier, solution et
 * commentaires compris==, et l'enregistrement le réécrit à sa place. Le
 * glisser-déposer reste pour les navigateurs qui ne savent pas ouvrir un
 * dossier.
 */
export type Catalogue = {
  /** Le nom du dossier choisi, pour qu'on voie lequel c'était. */
  nom: string
  entrees: EntreeDuDepot[]
}

/** Sans casse ni accents : « lecon » doit trouver « Leçon ». */
function aplatir(texte: string): string {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function Depot({
  possible,
  catalogue,
  enCours,
  onOuvrirDossier,
  onReprendre,
}: {
  /** Le navigateur sait-il ouvrir un dossier ? Chrome et Edge, aujourd'hui. */
  possible: boolean
  catalogue: Catalogue | null
  enCours: boolean
  onOuvrirDossier: () => void
  onReprendre: (entree: EntreeDuDepot) => void
}) {
  const [recherche, setRecherche] = useState('')

  if (!possible) {
    return (
      <p className="depot depot--absent">
        Sur Chrome ou Edge, l'atelier ouvre aussi le dossier du dépôt : on y retrouve chaque
        exercice et chaque leçon, solution comprise, et l'enregistrement les réécrit à leur place.
      </p>
    )
  }

  if (!catalogue) {
    return (
      <section className="depot" aria-label="Dépôt">
        <button type="button" className="bouton" onClick={onOuvrirDossier} disabled={enCours}>
          {enCours ? 'Lecture du dossier…' : 'Ouvrir le dossier du dépôt'}
        </button>
        <p className="depot__aide">
          Pour corriger un exercice ou une leçon déjà écrits, et l'enregistrer à sa place. Choisis
          la racine du dépôt, ou son dossier <code className="mono">contenu</code>.
        </p>
      </section>
    )
  }

  const mots = aplatir(recherche).split(/\s+/).filter(Boolean)
  const trouvees = catalogue.entrees.filter((entree) => {
    const botte = aplatir(`${entree.nom} ${entree.titre ?? ''}`)
    return mots.every((mot) => botte.includes(mot))
  })
  const total = catalogue.entrees.length

  return (
    <section className="depot" aria-label="Dépôt">
      <div className="depot__tete">
        <span>
          <strong>{catalogue.nom}</strong> — {total} fichier{total > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          className="depot__changer"
          onClick={onOuvrirDossier}
          disabled={enCours}
        >
          Changer de dossier
        </button>
      </div>

      {total === 0 ? (
        <p className="depot__aide">
          Aucun exercice ni leçon dans ce dossier. Choisis la racine du dépôt, ou son dossier{' '}
          <code className="mono">contenu</code>.
        </p>
      ) : (
        <>
          <label className="champ">
            <span>Chercher</span>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              // Entrée reprend le premier trouvé : taper `s3-07` puis Entrée
              // suffit, sans quitter le clavier.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trouvees[0]) onReprendre(trouvees[0])
              }}
              placeholder="s3-07, boucle, comparer… puis Entrée"
              spellCheck={false}
            />
          </label>
          {trouvees.length === 0 ? (
            <p className="depot__aide">Rien ne correspond à « {recherche.trim()} ».</p>
          ) : (
            <ul className="depot__liste">
              {trouvees.map((entree) => (
                <li key={entree.chemin}>
                  <button
                    type="button"
                    className="depot__fichier"
                    title={entree.chemin}
                    onClick={() => onReprendre(entree)}
                  >
                    <span className="mono">{entree.nom.replace(/\.yaml$/, '')}</span>{' '}
                    <span className="depot__titre">{entree.titre ?? 'titre illisible'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

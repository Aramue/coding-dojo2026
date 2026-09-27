import type { Essai } from '../../atelier/controles'

/**
 * Le panneau des essais.
 *
 * Il dit ce qui a échoué et pourquoi, jamais seulement « rouge ». Un verdict
 * sans motif renvoie l'auteur chercher lui-même, ce qui est exactement
 * l'aller-retour que l'atelier doit supprimer.
 */
export function Essais({
  essais,
  enCours,
  manquants,
  onLancer,
}: {
  essais: Essai[] | null
  enCours: boolean
  /** Les champs sans lesquels il n'y a rien à éprouver. */
  manquants: string[]
  onLancer: () => void
}) {
  if (manquants.length > 0) {
    return (
      <div className="essais">
        <p className="essais__vide">
          Il manque {manquants.join(', ')} avant de pouvoir éprouver cet exercice.
        </p>
      </div>
    )
  }

  return (
    <div className="essais">
      <button type="button" className="bouton bouton--sombre" onClick={onLancer} disabled={enCours}>
        {enCours ? 'Exécution…' : 'Lancer les essais'}
      </button>

      {essais === null && !enCours && (
        <p className="essais__vide">
          Rien pour l'instant. Les essais exécutent la solution et le code de départ par le moteur
          de l'élève, celui qui rendra le verdict en séance.
        </p>
      )}

      {essais !== null && (
        <ul className="essais__liste">
          {essais.map((essai, i) => (
            <li key={i} className="essai" data-verdict={essai.verdict}>
              <span className="essai__marque" aria-hidden="true">
                {essai.verdict === 'vert' ? '✓' : '✗'}
              </span>
              <div>
                <p className="essai__titre">{essai.titre}</p>
                {essai.detail && <pre className="essai__detail">{essai.detail}</pre>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {essais !== null && (
        <p className="essais__note">
          L'atelier prévient, la construction tranche : <code className="mono">valider_contenu.py</code>{' '}
          rejoue ces contrôles au déploiement et le fait échouer.
        </p>
      )}
    </div>
  )
}

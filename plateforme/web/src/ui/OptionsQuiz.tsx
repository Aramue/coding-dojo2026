import { Coche, FormeOption, LETTRES } from './FormeOption'

type Proprietes = {
  options: string[]
  /** Présent côté élève, pendant la question : les options deviennent des boutons. */
  onChoisir?: (choix: number) => void
  /** Plus de réponse possible : déjà répondu, ou temps écoulé. */
  verrouille?: boolean
  /** Le choix envoyé par l'élève, marqué sur son écran seulement. */
  choisi?: number | null
  /** Connue à la correction seulement : le serveur ne l'envoie pas avant. */
  bonneReponse?: number
  /** L'écran projeté, à la correction : combien ont choisi chaque option. */
  repartition?: number[] | null
}

/**
 * Les options d'une question, une famille de couleur chacune.
 *
 * C'est la seule grille de l'application qui mêle quatre familles sur un même
 * écran : la couleur y relie l'option projetée au bouton de l'élève. Voir la
 * Charte visuelle, amendement du 27 septembre 2026.
 */
export function OptionsQuiz({
  options,
  onChoisir,
  verrouille = false,
  choisi = null,
  bonneReponse,
  repartition,
}: Proprietes) {
  const corrigee = bonneReponse !== undefined
  const plusHaute = repartition ? Math.max(1, ...repartition) : 1

  return (
    <ol className="options-quiz" data-corrigee={corrigee || undefined}>
      {options.map((option, rang) => {
        const bonne = corrigee && rang === bonneReponse
        const mienne = choisi === rang
        const etat = !corrigee ? (mienne ? 'choisie' : undefined) : bonne ? 'bonne' : 'autre'
        const contenu = (
          <>
            <FormeOption rang={rang} />
            <span className="options-quiz__lettre">{LETTRES[rang]}</span>
            <span className="options-quiz__texte">{option}</span>
            {bonne && <Coche />}
            {bonne && <span className="sr-only">, bonne réponse</span>}
            {mienne && (
              <span className={corrigee ? 'options-quiz__mienne' : 'sr-only'}>
                {corrigee ? 'Ta réponse' : ', ta réponse'}
              </span>
            )}
            {repartition && (
              <span className="options-quiz__compte">
                <span className="options-quiz__jauge" aria-hidden="true">
                  <span style={{ transform: `scaleX(${(repartition[rang] ?? 0) / plusHaute})` }} />
                </span>
                {repartition[rang] ?? 0}
              </span>
            )}
          </>
        )

        return (
          <li
            key={rang}
            className="options-quiz__option"
            data-option={rang}
            data-etat={etat}
            data-mienne={corrigee && mienne && !bonne ? true : undefined}
          >
            {onChoisir && !corrigee ? (
              <button
                type="button"
                className="options-quiz__bouton"
                disabled={verrouille}
                aria-pressed={mienne}
                onClick={() => onChoisir(rang)}
              >
                {contenu}
              </button>
            ) : (
              <div className="options-quiz__bouton">{contenu}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

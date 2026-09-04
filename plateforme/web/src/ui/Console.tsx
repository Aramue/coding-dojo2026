import { useEffect, useRef } from 'react'
import './Console.css'

/**
 * Un passage du programme : un jeu d'entrées, et ce qu'il a affiché.
 *
 * Il y en a plusieurs quand l'exercice éprouve la solution sur plusieurs
 * exemples (s1-30, s1-31, s1-34…). Les afficher séparément évite la question
 * que posait une sortie unique recollée : « pourquoi mon programme demande
 * trois fois la même chose ? »
 */
export type Passage = { entrees: string[]; texte: string }

/**
 * Ce que le programme de l'élève écrit, pendant qu'il l'écrit.
 *
 * Le texte arrive du worker au fil de l'eau : il apparaît donc AVANT le
 * verdict, et il apparaît même quand le programme est coupé par le minuteur —
 * c'est le seul moyen, pour une boucle infinie, de voir ce qu'elle faisait.
 */
export function Console({ passages, enCours }: { passages: Passage[]; enCours: boolean }) {
  const corps = useRef<HTMLDivElement>(null)

  // Suivre la sortie qui s'écrit. `passages` change à chaque morceau reçu.
  useEffect(() => {
    const element = corps.current
    if (element) element.scrollTop = element.scrollHeight
  }, [passages])

  return (
    <section className="console" data-actif={enCours}>
      <header className="console__tete">
        <span className="console__titre">Console</span>
        <span className="console__etat">{enCours ? 'en cours' : 'sortie de ton programme'}</span>
      </header>

      <div className="console__corps" ref={corps} aria-live="polite" aria-atomic="false">
        {passages.length === 0 ? (
          <p className="console__vide">
            {enCours ? 'Ton programme démarre…' : "Rien pour l'instant. Valide pour l'exécuter."}
          </p>
        ) : (
          passages.map((passage, i) => (
            <div key={i} className="console__passage">
              {passages.length > 1 && (
                <p className="console__entrees">
                  {passage.entrees.length > 0
                    ? `Essai avec ${passage.entrees.join(', ')}`
                    : 'Essai sans réponse à saisir'}
                </p>
              )}
              {passage.texte ? (
                <pre className="console__texte">{passage.texte}</pre>
              ) : (
                <p className="console__vide">
                  {enCours ? '…' : "Ce passage n'a rien affiché."}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

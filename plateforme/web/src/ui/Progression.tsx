/**
 * Jauge de progression de la séance.
 *
 * Elle répond à la seule question que l'élève se pose en arrivant : combien il
 * en reste. Un pas par exercice, l'exercice courant marqué distinctement des
 * exercices réussis.
 */
export function Progression({ total, faits }: { total: number; faits: number }) {
  return (
    <div className="progression">
      <div
        className="progression__jauge"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={faits}
        aria-label="Progression dans la séance"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={
              'progression__pas' +
              (i < faits ? ' progression__pas--fait' : i === faits ? ' progression__pas--courant' : '')
            }
          />
        ))}
      </div>
      <span className="progression__compte">
        {faits} / {total}
      </span>
    </div>
  )
}

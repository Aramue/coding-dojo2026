import type { ResultatTest } from '../validation/types'
import './PanneauVerdict.css'

const CLASSES: Record<ResultatTest['verdict'], string> = {
  vert: 'verdict--vert',
  bleu: 'verdict--bleu',
  rouge: 'verdict--rouge',
}

const MARQUES: Record<ResultatTest['verdict'], string> = { vert: '✓', bleu: '≈', rouge: '✕' }

export function PanneauVerdict({ resultat }: { resultat: ResultatTest | null }) {
  if (!resultat) return null
  return (
    <div role="status" aria-live="polite" className={`verdict ${CLASSES[resultat.verdict]}`}>
      <span className="verdict__marque" aria-hidden="true">
        {MARQUES[resultat.verdict]}
      </span>
      <div className="verdict__texte">
        <b>{resultat.titre}</b>
        {resultat.detail && <span className="verdict__detail">{resultat.detail}</span>}
        {resultat.diff && (
          <pre className="verdict__diff" data-testid="diff">
            {resultat.diff.map((segment, index) =>
              segment.type === 'egal' ? (
                <span key={index}>{segment.texte}</span>
              ) : (
                <mark
                  key={index}
                  data-testid={`diff-${segment.type}`}
                  className={`diff diff--${segment.type}`}
                  title={segment.type === 'ajout' ? 'en trop' : 'manquant'}
                >
                  {segment.texte}
                </mark>
              ),
            )}
          </pre>
        )}
      </div>
    </div>
  )
}

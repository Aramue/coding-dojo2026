import type { ReactNode } from 'react'
import './CarteCode.css'

/** Le composant le plus reconnaissable des slides : carte sombre + pastilles macOS. */
export function CarteCode({ legende, children }: { legende?: ReactNode; children: ReactNode }) {
  return (
    <div className="carte-code">
      <div className="carte-code__barre">
        <span className="carte-code__pastille carte-code__pastille--rouge" />
        <span className="carte-code__pastille carte-code__pastille--jaune" />
        <span className="carte-code__pastille carte-code__pastille--verte" />
        {legende && <span className="carte-code__legende">{legende}</span>}
      </div>
      <div className="carte-code__corps">{children}</div>
    </div>
  )
}

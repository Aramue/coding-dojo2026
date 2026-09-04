import { useState, type FormEvent } from 'react'
import { TableauDeBord } from './TableauDeBord'
import './EcranProf.css'

/**
 * La porte du tableau de bord.
 *
 * Le code professeur ouvre la progression de toute la classe : il ne se met
 * pas dans l'URL, où il finirait dans l'historique et dans les captures
 * d'écran d'une projection en classe. Il se tape, et se garde le temps de
 * l'onglet — `sessionStorage`, jamais `localStorage`, parce que la machine de
 * la salle est partagée.
 */
const CLE_PROF = 'dojo.code-prof'

function lireCodeMemorise(): string | null {
  try {
    return sessionStorage.getItem(CLE_PROF)
  } catch {
    return null
  }
}

export function EcranProf() {
  const [code, setCode] = useState<string | null>(() => lireCodeMemorise())
  const [saisi, setSaisi] = useState('')

  function ouvrir(evenement: FormEvent) {
    evenement.preventDefault()
    const propre = saisi.trim()
    if (!propre) return
    try {
      sessionStorage.setItem(CLE_PROF, propre)
    } catch {
      // Sans mémoire, le code se retape au rechargement. Rien de plus.
    }
    setCode(propre)
  }

  function fermer() {
    try {
      sessionStorage.removeItem(CLE_PROF)
    } catch {
      // La clé n'a jamais pu être écrite.
    }
    setCode(null)
    setSaisi('')
  }

  if (code) {
    return (
      <main className="prof">
        <TableauDeBord codeProf={code} />
        <div className="prof__pied">
          <button type="button" className="bouton" onClick={fermer}>
            Fermer la session professeur
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="prof prof--porte">
      <form className="prof__carte" onSubmit={ouvrir}>
        <h1>Tableau de bord</h1>
        <p className="prof__intro">
          Qui avance, qui bloque, et sur quoi. La page se rafraîchit toute seule toutes les dix
          secondes.
        </p>
        <label htmlFor="code-prof">Code professeur</label>
        <input
          id="code-prof"
          type="password"
          value={saisi}
          onChange={(e) => setSaisi(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="bouton bouton--sombre" disabled={!saisi.trim()}>
          Ouvrir
        </button>
        <p className="prof__aide">
          Ce code est la valeur de <code className="mono">DOJO_CODE_PROF</code> dans le fichier{' '}
          <code className="mono">.env</code> du serveur.
        </p>
      </form>
    </main>
  )
}

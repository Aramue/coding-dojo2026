import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Executeur } from '../execution/executeur'
import type { Destination } from '../routage'
import { Apercu } from './Apercu'
import { Classe } from './Classe'
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
    return <SessionProf code={code} onFermer={fermer} />
  }

  return (
    <main className="prof prof--porte">
      <form className="prof__carte" onSubmit={ouvrir}>
        <h1>Tableau de bord</h1>
        <p className="prof__intro">
          Qui avance, qui bloque, et sur quoi. La page se rafraîchit toute seule toutes les dix
          secondes. C'est aussi ici que se crée la liste de la classe et que se distribuent les
          codes d'accès.
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


/**
 * Ce que le professeur voit une fois entré : la séance, sa classe, et l'aperçu
 * de l'espace élève quand il l'ouvre.
 */
function SessionProf({ code, onFermer }: { code: string; onFermer: () => void }) {
  // Un seul exécuteur pour tout l'aperçu, détruit en sortant : sans lui, les
  // exemples exécutables des leçons et le bouton « Valider » ne feraient rien.
  const executeur = useMemo(
    () => new Executeur(() => new Worker(new URL('../execution/worker.ts', import.meta.url))),
    [],
  )
  useEffect(() => () => executeur.detruire(), [executeur])

  // `null` : fermé. Une destination : ouvert là-dessus. `undefined` dans
  // l'objet signifie « ouvre où tu veux », c'est-à-dire la première leçon.
  const [apercu, setApercu] = useState<{ ou?: Destination } | null>(null)

  return (
    <main className="prof">
      <TableauDeBord codeProf={code} onApercu={(ou) => setApercu({ ou })} />

      <div className="prof__actions">
        <button type="button" className="bouton" onClick={() => setApercu({})}>
          Voir l'espace élève
        </button>
        <span className="prof__note">
          Le contenu réel, tel que la classe le lit. Rien n'y est enregistré.
        </span>
      </div>

      <Classe codeProf={code} />

      <div className="prof__pied">
        <button type="button" className="bouton" onClick={onFermer}>
          Fermer la session professeur
        </button>
      </div>

      {/* Par-dessus, pas à la place : le tableau attend derrière, intact. */}
      {apercu && (
        <Apercu depart={apercu.ou} executeur={executeur} onFermer={() => setApercu(null)} />
      )}
    </main>
  )
}

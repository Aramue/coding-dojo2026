import { useState } from 'react'

export function EcranConnexion({ onConnecte }: { onConnecte: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault()
    setEnCours(true)
    setErreur(null)
    try {
      await onConnecte(code.trim().toUpperCase())
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <main className="connexion" data-famille="variables">
      <h1>Quartier Général</h1>
      <p>Saisis le code d'agent qu'on t'a remis.</p>
      <form onSubmit={soumettre}>
        <label htmlFor="code">Code d'agent</label>
        <input
          id="code"
          className="mono"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AGENT-K7M2"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={enCours || code.trim().length < 4}>
          {enCours ? 'Connexion…' : 'Entrer'}
        </button>
      </form>
      {erreur && <p role="alert">{erreur}</p>}
    </main>
  )
}

import { useState, type FormEvent } from 'react'
import './EcranConnexion.css'

export function EcranConnexion({ onConnecte }: { onConnecte: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(evenement: FormEvent) {
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
    <main className="connexion">
      <div className="connexion__carte">
        {/*
          Rien ici ne nomme une séance : cet écran est le même le 16 et le 30
          septembre, et le contenu n'est chargé qu'une fois le code accepté.
        */}
        <h1>Introduction à la programmation</h1>
        <p className="connexion__intro">
          Écris tes premiers programmes en Python, une notion après l'autre. Ton code s'exécute
          dans ce navigateur et se corrige tout seul : tu sais immédiatement si tu as juste.
        </p>

        <form onSubmit={soumettre}>
          <label htmlFor="code">Code d'accès</label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DOJO-K7M2"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={erreur ? 'erreur-connexion' : undefined}
          />
          <button
            type="submit"
            className="bouton bouton--sombre"
            disabled={enCours || code.trim().length < 4}
          >
            {enCours ? 'Connexion…' : 'Commencer'}
          </button>
        </form>

        {erreur && (
          <p id="erreur-connexion" role="alert" className="alerte">
            {erreur}
          </p>
        )}
      </div>
    </main>
  )
}

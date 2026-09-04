import { useState } from 'react'
import type { Executeur } from '../execution/executeur'
import { Editeur } from './Editeur'

/**
 * Un éditeur sans verdict et sans enregistrement : l'élève modifie l'exemple de
 * la leçon et voit ce que ça change. Aucune progression n'est touchée — c'est
 * la différence avec un exercice, et elle doit rester visible dans les mots.
 */
export function BacASable({ code, executeur }: { code: string; executeur: Executeur }) {
  const [source, setSource] = useState(code)
  const [sortie, setSortie] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function executer() {
    setEnCours(true)
    const resultat = await executeur.executer({ code: source, entrees: [], nomsVariables: [] })
    setEnCours(false)

    if (resultat.timeout) {
      setSortie('Le programme a été trop long : il a été arrêté.')
      return
    }
    // Le message d'erreur cite le code de l'élève. Ici il ne quitte pas son
    // navigateur — rien n'est envoyé à l'API — donc l'afficher est sans
    // danger, et c'est le SEUL endroit de l'application où c'est vrai.
    // Sans lui, l'élève ne comprend pas pourquoi rien ne s'affiche.
    if (resultat.erreur) {
      setSortie(`${resultat.stdout}${resultat.erreur.type} : ${resultat.erreur.message}`)
      return
    }
    setSortie(resultat.stdout)
  }

  return (
    <div className="bac">
      <Editeur valeur={source} onChange={setSource} />
      <div className="bac__actions">
        <button type="button" className="bouton" onClick={executer} disabled={enCours}>
          {enCours ? 'Exécution…' : 'Exécuter'}
        </button>
        <span className="bac__note">rien n'est enregistré ici</span>
      </div>
      {sortie !== null && (
        <pre className="bac__sortie mono" aria-live="polite">
          {sortie.trimEnd() || '(aucune sortie)'}
        </pre>
      )}
    </div>
  )
}

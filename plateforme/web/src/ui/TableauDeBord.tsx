import { useEffect, useState } from 'react'
import './TableauDeBord.css'

type LigneEleve = {
  code_acces: string
  exercice_id: string
  // Pas de "termine" : le determiner supposerait de connaitre le nombre total
  // d'exercices de la seance, une donnee que seul le front possede. Le faire
  // remonter par le client reviendrait a faire confiance a son navigateur —
  // la lecon des rondes de la tache 11. "reussis" suffit deja a voir qui avance.
  statut: 'bloque' | 'inactif' | 'en_cours'
  echecs_consecutifs: number
  inactif_depuis_s: number
  dernier_type_erreur: string | null
  reussis: number
}

const LIBELLES: Record<LigneEleve['statut'], string> = {
  bloque: 'Bloqué',
  inactif: 'Inactif',
  en_cours: 'En cours',
}

function minutes(secondes: number): string {
  return `${Math.floor(secondes / 60)} min`
}

export function TableauDeBord({ codeProf }: { codeProf: string }) {
  const [eleves, setEleves] = useState<LigneEleve[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    async function rafraichir() {
      try {
        const reponse = await fetch('/api/prof/seance', { headers: { 'X-Code-Prof': codeProf } })
        if (!reponse.ok) throw new Error('Accès refusé.')
        const donnees = await reponse.json()
        if (vivant) {
          setEleves(donnees.eleves)
          setErreur(null)
        }
      } catch (e) {
        if (vivant) setErreur(e instanceof Error ? e.message : 'Erreur réseau.')
      }
    }
    rafraichir()
    const minuteur = setInterval(rafraichir, 10_000)
    return () => {
      vivant = false
      clearInterval(minuteur)
    }
  }, [codeProf])

  return (
    <main className="tableau">
      <header className="tableau__entete">
        <h1>Séance en cours</h1>
        <p>{eleves.length} élèves connectés</p>
      </header>
      {erreur && <p role="alert">{erreur}</p>}
      <div className="tableau__lignes">
        {eleves.map((a) => (
          <article key={a.code_acces} className={`ligne ligne--${a.statut}`}>
            <span className="mono ligne__eleve">{a.code_acces}</span>
            <span className="ligne__ou">{a.exercice_id}</span>
            <span className="ligne__quoi">
              {a.statut === 'bloque' &&
                `${a.echecs_consecutifs} échecs d'affilée${a.dernier_type_erreur ? ` — ${a.dernier_type_erreur}` : ''}`}
              {a.statut === 'inactif' && `aucune soumission depuis ${minutes(a.inactif_depuis_s)}`}
              {a.statut === 'en_cours' && `${a.reussis} exercices validés`}
            </span>
            <span className={`statut statut--${a.statut}`}>
              {LIBELLES[a.statut]}
              {a.statut === 'bloque' && ` ${minutes(a.inactif_depuis_s)}`}
            </span>
          </article>
        ))}
      </div>
    </main>
  )
}

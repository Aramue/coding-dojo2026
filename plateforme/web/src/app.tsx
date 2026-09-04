import { useEffect, useMemo, useState } from 'react'
import { ClientApi } from './api/client'
import { chargerParcours } from './contenu/chargeur'
import type { Exercice } from './contenu/types'
import { Executeur } from './execution/executeur'
import { EcranConnexion } from './ui/EcranConnexion'
import { EcranExercice } from './ui/EcranExercice'
import { Progression } from './ui/Progression'

/** Nom lisible d'une famille de concept, pour l'en-tête. */
const CONCEPTS: Record<Exercice['famille'], string> = {
  variables: 'Variables',
  types: 'Types de données',
  operateurs: 'Opérateurs',
  conditions: 'Conditions',
  boucles: 'Boucles',
}

export function App() {
  const client = useMemo(() => new ClientApi(), [])
  const executeur = useMemo(
    () => new Executeur(() => new Worker(new URL('./execution/worker.ts', import.meta.url))),
    [],
  )
  const [codeAcces, setCodeAcces] = useState<string | null>(null)
  const [exercices, setExercices] = useState<Exercice[]>([])
  const [reussis, setReussis] = useState<string[]>([])
  const [alerte, setAlerte] = useState<string | null>(null)

  useEffect(() => () => executeur.detruire(), [executeur])

  async function connecter(code: string) {
    const identifiant = await client.ouvrirSession(code)
    setExercices(await chargerParcours())
    setReussis(await client.lireParcours())
    setCodeAcces(identifiant)
  }

  if (!codeAcces) {
    return (
      <div className="appli">
        <Entete />
        <EcranConnexion onConnecte={connecter} />
      </div>
    )
  }

  if (!exercices.length) {
    return (
      <div className="appli">
        <Entete codeAcces={codeAcces} />
        <p className="chargement">Chargement des exercices…</p>
      </div>
    )
  }

  const courant = exercices.find((e) => !reussis.includes(e.id))
  const faits = exercices.filter((e) => reussis.includes(e.id)).length

  if (!courant) {
    return (
      <div className="appli">
        <Entete codeAcces={codeAcces} total={exercices.length} faits={faits} />
        <main className="fin">
          <div className="fin__carte">
            <p className="fin__compte">{faits}</p>
            <h1>Séance terminée</h1>
            <p>
              Tu as résolu les {exercices.length} exercices de la séance. Ta progression est
              enregistrée : tu la retrouveras à la prochaine connexion.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="appli">
      <Entete
        codeAcces={codeAcces}
        concept={CONCEPTS[courant.famille]}
        total={exercices.length}
        faits={faits}
      />
      {alerte && (
        <p role="alert" className="alerte">
          {alerte}
        </p>
      )}
      <EcranExercice
        exercice={courant}
        executeur={executeur}
        onTentative={async (resultat, dureeMs, typeErreurPython) => {
          try {
            await client.enregistrerTentative({
              exerciceId: courant.id,
              verdict: resultat.verdict,
              // Le NOM de l'exception, jamais le message : les messages
              // contiennent des identifiants tapés par l'élève.
              typeErreur: typeErreurPython,
              dureeMs,
            })
            setAlerte(null)
            if (resultat.verdict !== 'rouge') setReussis((liste) => [...liste, courant.id])
          } catch {
            // On ne fait PAS avancer l'élève sur une tentative non enregistrée :
            // il la croirait acquise et la retrouverait au rechargement.
            setAlerte(
              "Ta progression n'a pas pu être enregistrée. Préviens ton professeur avant de continuer.",
            )
          }
        }}
      />
    </div>
  )
}

function Entete({
  codeAcces,
  concept,
  total,
  faits,
}: {
  codeAcces?: string
  concept?: string
  total?: number
  faits?: number
}) {
  return (
    <header className="entete">
      <span className="entete__marque">
        Coding Dojo <span>Python</span>
      </span>
      {concept && <span className="entete__concept">{concept}</span>}
      {total !== undefined && faits !== undefined && <Progression total={total} faits={faits} />}
      {codeAcces && <span className="entete__code mono">{codeAcces}</span>}
    </header>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { ClientApi } from './api/client'
import { chargerParcours } from './contenu/chargeur'
import type { Exercice } from './contenu/types'
import { Executeur } from './execution/executeur'
import { EcranConnexion } from './ui/EcranConnexion'
import { EcranExercice } from './ui/EcranExercice'

export function App() {
  const client = useMemo(() => new ClientApi(), [])
  const executeur = useMemo(
    () => new Executeur(() => new Worker(new URL('./execution/worker.ts', import.meta.url))),
    [],
  )
  const [connecte, setConnecte] = useState(false)
  const [exercices, setExercices] = useState<Exercice[]>([])
  const [reussis, setReussis] = useState<string[]>([])

  useEffect(() => () => executeur.detruire(), [executeur])

  async function connecter(code: string) {
    await client.ouvrirSession(code)
    setExercices(await chargerParcours())
    setReussis(await client.lireParcours())
    setConnecte(true)
  }

  if (!connecte) return <EcranConnexion onConnecte={connecter} />

  const courant = exercices.find((e) => !reussis.includes(e.id))
  if (!courant) return <main><h1>Séance terminée. Beau travail, agent.</h1></main>

  return (
    <EcranExercice
      exercice={courant}
      executeur={executeur}
      onTentative={async (resultat, dureeMs) => {
        await client.enregistrerTentative({
          exerciceId: courant.id,
          verdict: resultat.verdict,
          typeErreur: resultat.verdict === 'rouge' ? resultat.titre.slice(0, 64) : null,
          dureeMs,
        })
        if (resultat.verdict !== 'rouge') setReussis((liste) => [...liste, courant.id])
      }}
    />
  )
}

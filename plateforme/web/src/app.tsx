import { useEffect, useMemo, useState } from 'react'
import { ClientApi } from './api/client'
import { chargerLecons, chargerNotions, chargerParcours } from './contenu/chargeur'
import { grouper, premiereOuverte } from './contenu/notions'
import { Executeur } from './execution/executeur'
import { naviguer, useRoute, type Destination } from './routage'
import { EcranConnexion } from './ui/EcranConnexion'
import { EcranExercice } from './ui/EcranExercice'
import { EcranProf } from './ui/EcranProf'
import { Menu } from './ui/Menu'
import { PageCours } from './ui/PageCours'
import { PageExercices } from './ui/PageExercices'
import type { Exercice, Lecon, Notion } from './contenu/types'
import type { GroupeNotion } from './contenu/notions'
import type { ResultatTest } from './validation/types'

/**
 * Le code d'accès survit à un rechargement, mais pas à la fermeture de
 * l'onglet : `sessionStorage`, jamais `localStorage`. Les machines des huit
 * établissements sont partagées — le code du voisin ne doit pas y rester.
 *
 * Ce n'est pas une donnée personnelle : c'est un pseudonyme distribué en
 * séance. Voir ADR-002.
 */
const CLE_SESSION = 'dojo.code-acces'

function lireCodeMemorise(): string | null {
  try {
    return sessionStorage.getItem(CLE_SESSION)
  } catch {
    // Navigation privée, ou stockage refusé : on retombe sur la saisie manuelle.
    return null
  }
}

function memoriserCode(code: string): void {
  try {
    sessionStorage.setItem(CLE_SESSION, code)
  } catch {
    // Sans mémoire, l'élève retapera son code au rechargement. Rien de plus.
  }
}

function oublierCode(): void {
  try {
    sessionStorage.removeItem(CLE_SESSION)
  } catch {
    // Rien à faire : la clé n'a jamais pu être écrite.
  }
}

export function App() {
  const client = useMemo(() => new ClientApi(), [])
  const executeur = useMemo(
    () => new Executeur(() => new Worker(new URL('./execution/worker.ts', import.meta.url))),
    [],
  )
  const destination = useRoute()
  const [codeAcces, setCodeAcces] = useState<string | null>(null)
  const [contenu, setContenu] = useState<{
    notions: Notion[]
    exercices: Exercice[]
    lecons: Lecon[]
  }>({ notions: [], exercices: [], lecons: [] })
  const [reussis, setReussis] = useState<string[]>([])
  const [alerte, setAlerte] = useState<string | null>(null)

  // Derive, jamais stocke : sans cela, le compteur du menu resterait fige sur
  // sa valeur du moment de la connexion, et valider un exercice ne se verrait
  // nulle part.
  const groupes = useMemo(
    () => grouper(contenu.notions, contenu.exercices, contenu.lecons, reussis),
    [contenu, reussis],
  )

  useEffect(() => () => executeur.detruire(), [executeur])

  // Reconnexion silencieuse au chargement : sans elle, un rafraichissement
  // renvoie l'eleve a la saisie du code et lui fait perdre sa page.
  useEffect(() => {
    const memorise = lireCodeMemorise()
    if (!memorise) return
    connecter(memorise).catch(() => oublierCode())
    // Volontairement au montage seulement : `connecter` change a chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connecter(saisi: string) {
    const identifiant = await client.ouvrirSession(saisi)
    const [notions, exercices, lecons, acquis] = await Promise.all([
      chargerNotions(),
      chargerParcours(),
      chargerLecons(),
      client.lireParcours(),
    ])
    setContenu({ notions, exercices, lecons })
    setReussis(acquis)
    setCodeAcces(identifiant)
    memoriserCode(identifiant)

    // Une URL profonde ouverte avant connexion est conservée ; sinon on envoie
    // l'élève sur la première notion qu'il n'a pas terminée.
    if (destination.vue === 'connexion') {
      const ouverte = premiereOuverte(grouper(notions, exercices, lecons, acquis))
      if (ouverte) naviguer({ vue: 'cours', notion: ouverte.id })
    }
  }

  // Le tableau de bord ne passe pas par le code eleve : il a sa propre porte,
  // et il doit rester atteignable meme si personne n'est connecte cote eleve.
  if (destination.vue === 'prof') {
    return (
      <div className="appli appli--seul">
        <Entete />
        <EcranProf />
      </div>
    )
  }

  if (!codeAcces) {
    return (
      <div className="appli appli--seul">
        <Entete />
        <EcranConnexion onConnecte={connecter} />
      </div>
    )
  }

  return (
    <div className="appli">
      <Entete codeAcces={codeAcces} groupes={groupes} />
      <Menu groupes={groupes} destination={destination} />
      {alerte && (
        <p role="alert" className="alerte">
          {alerte}
        </p>
      )}
      <Vue
        destination={destination}
        groupes={groupes}
        reussis={reussis}
        executeur={executeur}
        client={client}
        onReussi={(id) => setReussis((liste) => [...liste, id])}
        onAlerte={setAlerte}
      />
    </div>
  )
}

type ProprietesVue = {
  destination: Destination
  groupes: GroupeNotion[]
  reussis: string[]
  executeur: Executeur
  client: ClientApi
  onReussi: (id: string) => void
  onAlerte: (message: string | null) => void
}

/**
 * L'aiguillage ne fait que choisir une page. Toute la logique vit dans les
 * composants et dans `notions.ts` — cette fonction reste lisible d'un coup d'œil.
 */
function Vue({
  destination,
  groupes,
  reussis,
  executeur,
  client,
  onReussi,
  onAlerte,
}: ProprietesVue) {
  const groupe =
    'notion' in destination ? groupes.find((g) => g.id === destination.notion) : undefined

  if (!groupe) return <Introuvable />

  if (destination.vue === 'cours') return <PageCours groupe={groupe} executeur={executeur} />
  if (destination.vue === 'exercices') {
    const rang = groupes.indexOf(groupe)
    return (
      <PageExercices groupe={groupe} reussis={reussis} suivante={groupes[rang + 1]} />
    )
  }

  if (destination.vue === 'exercice') {
    const exercice = groupe.exercices[destination.numero - 1]
    if (!exercice) return <Introuvable />

    const avant = groupe.exercices[destination.numero - 2]
    const apres = groupe.exercices[destination.numero]
    return (
      <EcranExercice
        titreNotion={groupe.titre}
        precedent={
          avant
            ? {
                cible: { vue: 'exercice', notion: groupe.id, numero: destination.numero - 1 },
                libelle: avant.titre,
              }
            : { cible: { vue: 'exercices', notion: groupe.id }, libelle: 'Liste des exercices' }
        }
        suivant={
          apres
            ? {
                cible: { vue: 'exercice', notion: groupe.id, numero: destination.numero + 1 },
                libelle: apres.titre,
              }
            : { cible: { vue: 'exercices', notion: groupe.id }, libelle: 'Liste des exercices' }
        }
        // `key` force un composant neuf en changeant d'exercice : sans elle,
        // l'éditeur garderait le code tapé pour le précédent.
        key={exercice.id}
        exercice={exercice}
        executeur={executeur}
        onTentative={async (resultat: ResultatTest, dureeMs, typeErreurPython) => {
          try {
            await client.enregistrerTentative({
              exerciceId: exercice.id,
              verdict: resultat.verdict,
              // Le NOM de l'exception, jamais le message : les messages
              // contiennent des identifiants tapés par l'élève.
              typeErreur: typeErreurPython,
              dureeMs,
            })
            onAlerte(null)
            if (resultat.verdict !== 'rouge') onReussi(exercice.id)
          } catch {
            // On ne fait PAS avancer l'élève sur une tentative non enregistrée :
            // il la croirait acquise et la retrouverait au rechargement.
            onAlerte(
              "Ta progression n'a pas pu être enregistrée. Préviens ton professeur avant de continuer.",
            )
          }
        }}
      />
    )
  }

  return <Introuvable />
}

function Introuvable() {
  return (
    <main className="introuvable">
      <h1>Cette page n'existe pas</h1>
      <p>Choisis une notion dans le menu.</p>
    </main>
  )
}

function Entete({
  codeAcces,
  groupes = [],
}: {
  codeAcces?: string
  groupes?: GroupeNotion[]
}) {
  const total = groupes.reduce((n, g) => n + g.exercices.length, 0)
  const faits = groupes.reduce((n, g) => n + g.faits, 0)

  return (
    <header className="entete">
      <span className="entete__marque">
        Coding Dojo <span>Python</span>
      </span>
      {codeAcces && <span className="entete__seance">Séance 1 — les bases de Python</span>}
      <span className="entete__espace" />
      {total > 0 && (
        <span
          className="entete__avancement"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={faits}
          aria-label="Progression dans la séance"
        >
          <span className="entete__jauge" aria-hidden="true">
            <span style={{ width: `${(faits / total) * 100}%` }} />
          </span>
          {faits} / {total}
        </span>
      )}
      {codeAcces && <span className="entete__code mono">{codeAcces}</span>}
    </header>
  )
}

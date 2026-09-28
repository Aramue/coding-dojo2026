import { useEffect, useMemo, useRef, useState } from 'react'
import { ClientApi, type Identite } from './api/client'
import { aujourdhui, contenuDisponible } from './contenu/calendrier'
import { chargerContenu } from './contenu/chargeur'
import { grouper, grouperParChapitre, premiereOuverte } from './contenu/notions'
import { Executeur } from './execution/executeur'
import type { EtatEleve } from './quiz/types'
import { useFluxQuiz } from './quiz/useFluxQuiz'
import { naviguer, useRoute, versChemin, type Destination } from './routage'
import { BandeauQuiz, partieOuverte } from './ui/BandeauQuiz'
import { EcranConnexion } from './ui/EcranConnexion'
import { EcranExercice } from './ui/EcranExercice'
import { EcranProf } from './ui/EcranProf'
import { EcranQuiz } from './ui/EcranQuiz'
import { Menu } from './ui/Menu'
import { PageCours } from './ui/PageCours'
import { PageExercices } from './ui/PageExercices'
import type { Chapitre, ContenuPublie } from './contenu/types'
import type { GroupeNotion } from './contenu/notions'
import type { Reussite, ResultatTest } from './validation/types'

/**
 * Le code d'accès survit à un rechargement, mais pas à la fermeture de
 * l'onglet : `sessionStorage`, jamais `localStorage`. Les machines des huit
 * établissements sont partagées — le code du voisin ne doit pas y rester.
 *
 * Ce n'est pas une donnée personnelle : c'est un pseudonyme distribué en
 * séance. Voir ADR-002.
 */
const CLE_SESSION = 'dojo.code-acces'

/**
 * Hors de la page du quiz, le bandeau et le menu relisent toutes les dix
 * secondes quand la sonnette ne passe pas : ils n'ont qu'à savoir si une
 * partie existe, pas à suivre une question à la seconde.
 */
const RELEVE_HORS_PARTIE_MS = 10_000

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
  const [identite, setIdentite] = useState<Identite | null>(null)
  const [contenu, setContenu] = useState<ContenuPublie>({
    chapitres: [],
    notions: [],
    exercices: [],
    lecons: [],
  })
  const [reussis, setReussis] = useState<Reussite[]>([])
  const [alerte, setAlerte] = useState<string | null>(null)

  // La sonnette de la coquille : c'est elle qui allume le bandeau et l'entrée
  // du menu à la création d'une partie, et les éteint à sa fin. Elle reste
  // branchée sur /quiz aussi : c'est elle qui tient le cours fermé, et le
  // sommaire se voit depuis la page du quiz.
  const surLeQuiz = destination.vue === 'quiz'
  const quiz = useFluxQuiz<EtatEleve>(
    () => client.lireQuiz(),
    () => client.presentationQuiz(),
    { actif: identite !== null, repliMs: RELEVE_HORS_PARTIE_MS },
  )
  const quizOuvert = partieOuverte(quiz.etat)
  // Pendant une partie, tout le cours se ferme : chapitres, leçons, exercices.
  // Seule l'entrée du quiz reste ouverte.
  const coursFerme = quizOuvert && !surLeQuiz

  // La dernière page de cours visitée : c'est là que l'élève revient après
  // le quiz, et non au début du parcours.
  const dernierCours = useRef<Destination | null>(null)
  useEffect(() => {
    if ('notion' in destination) dernierCours.current = destination
  }, [destination])

  // Derive, jamais stocke : sans cela, le compteur du menu resterait fige sur
  // sa valeur du moment de la connexion, et valider un exercice ne se verrait
  // nulle part.
  const groupes = useMemo(
    () => grouper(contenu.notions, contenu.exercices, contenu.lecons, reussis),
    [contenu, reussis],
  )
  const chapitres = useMemo(
    () => grouperParChapitre(contenu.chapitres, groupes),
    [contenu.chapitres, groupes],
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
    const qui = await client.ouvrirSession(saisi)
    const [tout, acquis] = await Promise.all([chargerContenu(), client.lireParcours()])
    // Une séance publiée d'avance reste fermée jusqu'à sa date : elle ne doit
    // rien changer à celle qui se déroule. Voir ADR-013.
    const publie = contenuDisponible(tout, aujourdhui())
    setContenu(publie)
    setReussis(acquis)
    setIdentite(qui)
    memoriserCode(qui.codeAcces)

    // Une URL profonde ouverte avant connexion est conservée ; sinon on envoie
    // l'élève sur la première notion qu'il n'a pas terminée.
    if (destination.vue === 'connexion') {
      const ouverte = premiereOuverte(
        grouper(publie.notions, publie.exercices, publie.lecons, acquis),
      )
      if (ouverte) naviguer({ vue: 'cours', notion: ouverte.id })
    }
  }

  // Le tableau de bord ne passe pas par le code eleve : il a sa propre porte,
  // et il doit rester atteignable meme si personne n'est connecte cote eleve.
  if (destination.vue === 'prof' || destination.vue === 'prof-quiz') {
    return (
      <div className="appli appli--seul">
        <Entete />
        <EcranProf quiz={destination.vue === 'prof-quiz'} />
      </div>
    )
  }

  if (!identite) {
    return (
      <div className="appli appli--seul">
        <Entete />
        <EcranConnexion onConnecte={connecter} />
      </div>
    )
  }

  return (
    <div className="appli">
      <Entete
        identite={identite}
        groupes={groupes}
        // La séance du jour : celle du dernier chapitre ouvert.
        chapitre={chapitres[chapitres.length - 1]}
      />
      {!surLeQuiz && <BandeauQuiz etat={quiz.etat} />}
      <Menu
        chapitres={chapitres}
        destination={destination}
        quiz={{
          ouvert: quizOuvert,
          titre: quizOuvert && quiz.etat?.partie !== null ? quiz.etat?.titre : undefined,
        }}
        verrouille={quizOuvert}
      />
      {alerte && (
        <p role="alert" className="alerte">
          {alerte}
        </p>
      )}
      {coursFerme && <CoursFerme />}
      {/*
        Toujours là, même cours ouvert : ajouter ou retirer ce conteneur
        remonterait la page, et l'élève perdrait le code qu'il était en train
        d'écrire quand la partie a commencé. `inert` suffit à tout rendre
        inerte — clic, clavier, focus — sans rien démonter.
      */}
      <div className="zone-cours" inert={coursFerme}>
        <Vue
          // `key` remonte la vue à chaque changement de page : c'est ce qui
          // rejoue l'animation d'entrée, sans état à piloter.
          key={versChemin(destination)}
          destination={destination}
          groupes={groupes}
          reussis={reussis}
          executeur={executeur}
          client={client}
          onRetourCours={() => {
            const ouverte = premiereOuverte(groupes) ?? groupes[0]
            const cible =
              dernierCours.current ?? (ouverte ? { vue: 'cours' as const, notion: ouverte.id } : null)
            if (cible) naviguer(cible)
          }}
          onReussi={(reussite) =>
            setReussis((liste) => [
              // Une seule entrée par exercice, et on garde la meilleure : rejouer
              // moins bien ne retire pas une coche déjà obtenue.
              ...liste.filter((r) => r.exerciceId !== reussite.exerciceId),
              liste.find((r) => r.exerciceId === reussite.exerciceId && r.verdict === 'vert') ??
                reussite,
            ])
          }
          onAlerte={setAlerte}
        />
      </div>
    </div>
  )
}

/**
 * Par-dessus la page de cours, pendant une partie. La page reste montée
 * dessous, inerte : à la fin de la partie, l'élève la retrouve telle quelle.
 */
function CoursFerme() {
  return (
    <section className="cours-ferme" aria-labelledby="titre-cours-ferme">
      <h2 id="titre-cours-ferme">Le cours est fermé pendant le quiz</h2>
      <p>Il rouvre dès la fin de la partie, et cette page t'attend telle que tu l'as laissée.</p>
      <button
        type="button"
        className="bouton bouton--primaire"
        onClick={() => {
          naviguer({ vue: 'quiz' })
          scrollTo({ top: 0 })
        }}
      >
        Aller au quiz
      </button>
    </section>
  )
}

type ProprietesVue = {
  destination: Destination
  groupes: GroupeNotion[]
  reussis: Reussite[]
  executeur: Executeur
  client: ClientApi
  onReussi: (reussite: Reussite) => void
  onAlerte: (message: string | null) => void
  onRetourCours: () => void
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
  onRetourCours,
}: ProprietesVue) {
  if (destination.vue === 'quiz') return <EcranQuiz client={client} onRetourCours={onRetourCours} />

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
        dejaFait={reussis.find((r) => r.exerciceId === exercice.id)}
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
            if (resultat.verdict !== 'rouge') {
              onReussi({
                exerciceId: exercice.id,
                verdict: resultat.verdict,
                le: new Date().toISOString(),
              })
            }
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
  identite,
  groupes = [],
  chapitre,
}: {
  identite?: Identite
  groupes?: GroupeNotion[]
  chapitre?: Chapitre
}) {
  // Obligatoires seulement : la jauge de l'en-tete est le chemin minimal.
  const total = groupes.reduce((n, g) => n + g.total, 0)
  const faits = groupes.reduce((n, g) => n + g.faits, 0)

  return (
    <header className="entete">
      <span className="entete__marque">
        Coding Dojo <span>Python</span>
      </span>
      {identite && chapitre && (
        <span className="entete__seance">
          Séance {chapitre.seance} — {chapitre.titre}
        </span>
      )}
      <span className="entete__espace" />
      {total > 0 && (
        <span
          className="entete__avancement"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={faits}
          aria-label="Progression dans le cours"
        >
          <span className="entete__jauge" aria-hidden="true">
            <span style={{ width: `${(faits / total) * 100}%` }} />
          </span>
          {faits} / {total}
        </span>
      )}
      {identite && (
        <span className="entete__qui">
          {/*
            Le prénom d'abord : c'est ce qui dit « c'est bien MA session » à un
            élève qui vient de taper quatre caractères sur une machine partagée.
            Le code reste dessous, plus discret — il sert quand il faut le
            redonner au professeur, pas à chaque coup d'œil.
          */}
          {identite.prenom && <b className="entete__prenom">{identite.prenom}</b>}
          <span className="entete__code mono">{identite.codeAcces}</span>
        </span>
      )}
    </header>
  )
}

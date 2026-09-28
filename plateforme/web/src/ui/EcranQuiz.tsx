import { useEffect, useState } from 'react'
import type { ClientApi } from '../api/client'
import { restant } from '../quiz/horloge'
import type { EtatEleve } from '../quiz/types'
import { useFluxQuiz } from '../quiz/useFluxQuiz'
import { CarteCode } from './CarteCode'
import { CompteARebours } from './CompteARebours'
import { OptionsQuiz } from './OptionsQuiz'
import { PastillesJoueurs } from './PastillesJoueurs'
import './Quiz.css'

type Partie = Exclude<EtatEleve, { partie: null }>

function nombre(n: number): string {
  return n.toLocaleString('fr-CH')
}

function accord(n: number, un: string, plusieurs: string): string {
  return `${nombre(n)} ${n <= 1 ? un : plusieurs}`
}

/** « 1er », « 2e » : le rang se lit comme on le dit. */
function rang(n: number): string {
  return n === 1 ? '1er' : `${n}e`
}

/**
 * La partie de quiz, vue par l'élève.
 *
 * L'écran ne décide de rien : il montre la photographie que le serveur lui
 * rend, et relit quand la sonnette le dit. La bonne réponse n'arrive qu'avec
 * la correction — elle n'existe pas dans le navigateur avant. Voir ADR-015.
 *
 * Ce que l'élève voit des autres : leur nombre, et son propre rang parmi eux.
 * Jamais un nom, jamais un score qui ne soit pas le sien.
 */
export function EcranQuiz({
  client,
  onRetourCours,
}: {
  client: ClientApi
  /** Ramène l'élève à la page de cours qu'il a quittée pour le quiz. */
  onRetourCours?: () => void
}) {
  const { etat, ecartMs, erreur, flux } = useFluxQuiz<EtatEleve>(
    () => client.lireQuiz(),
    () => client.presentationQuiz(),
  )
  const [refus, setRefus] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function agir(action: () => Promise<EtatEleve>) {
    setEnvoi(true)
    const envoiA = Date.now()
    try {
      flux.recevoir(await action(), envoiA)
      setRefus(null)
    } catch (e) {
      // « Le temps de réponse est écoulé. » : le serveur écrit ses refus pour
      // l'élève. On les montre, puis on relit — l'écran avait un temps de retard.
      setRefus(e instanceof Error ? e.message : 'Réponse non enregistrée.')
      void flux.relire()
    } finally {
      setEnvoi(false)
    }
  }

  const partie = etat && etat.partie !== null ? (etat as Partie) : null
  const question = partie?.phase === 'question' ? partie.question : null
  // Relu à chaque rendu : le minuteur d'échéance plus bas en provoque un au bon moment.
  const ecoule = question ? restant(question.fin_a, ecartMs, Date.now()) === 0 : false
  const peutRepondre = Boolean(question && !partie?.ma_reponse && !envoi && !ecoule)

  function repondre(choix: number) {
    if (!partie || !question) return
    void agir(() => client.repondreQuiz(partie.partie, question.rang, choix))
  }

  // Un refus parle de la question où il est arrivé : il s'efface avec elle.
  const repere = partie ? `${partie.partie}:${partie.question?.rang ?? -1}` : ''
  useEffect(() => setRefus(null), [repere])

  // À l'échéance, l'écran se redessine de lui-même : les options se verrouillent
  // et « Temps écoulé » s'affiche sans attendre la relecture de la correction.
  const [, setTic] = useState(0)
  const finA = question?.fin_a
  useEffect(() => {
    if (!finA) return
    const dans = restant(finA, ecartMs, Date.now())
    if (dans <= 0) return
    const minuteur = setTimeout(() => setTic((n) => n + 1), dans + 20)
    return () => clearTimeout(minuteur)
  }, [finA, ecartMs])

  // Les touches 1 à 4 : on répond sans chercher la souris, comme on lève la main.
  useEffect(() => {
    if (!peutRepondre || !question) return
    function touche(evenement: KeyboardEvent) {
      if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return
      const choix = Number(evenement.key) - 1
      if (!Number.isInteger(choix) || choix < 0 || choix >= question!.options.length) return
      evenement.preventDefault()
      repondre(choix)
    }
    addEventListener('keydown', touche)
    return () => removeEventListener('keydown', touche)
    // `repondre` change à chaque rendu ; `peutRepondre` et `question` suffisent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peutRepondre, question])

  return (
    <main className="quiz">
      {(erreur || refus) && (
        <p role="alert" className="quiz__alerte">
          {refus ?? erreur}
        </p>
      )}
      {!etat && <p className="quiz__attente">Chargement du quiz…</p>}
      {etat && !partie && <AucunePartie onRetourCours={onRetourCours} />}
      {partie && (
        <Partie
          onRetourCours={onRetourCours}
          partie={partie}
          ecartMs={ecartMs}
          envoi={envoi}
          ecoule={ecoule}
          peutRepondre={peutRepondre}
          onRejoindre={() => void agir(() => client.rejoindreQuiz())}
          onRepondre={repondre}
        />
      )}
    </main>
  )
}

function RetourCours({ onRetourCours }: { onRetourCours?: () => void }) {
  if (!onRetourCours) return null
  return (
    <button type="button" className="bouton" onClick={onRetourCours}>
      Retourner au cours
    </button>
  )
}

function AucunePartie({ onRetourCours }: { onRetourCours?: () => void }) {
  return (
    <section className="quiz__carte">
      <h1>Aucun quiz en cours</h1>
      <p className="quiz__aide">
        Quand ton professeur en lancera un, un bandeau apparaîtra en haut de ton espace. Tu peux
        continuer tes exercices en attendant.
      </p>
      <RetourCours onRetourCours={onRetourCours} />
    </section>
  )
}

function Partie({
  onRetourCours,
  partie,
  ecartMs,
  envoi,
  ecoule,
  peutRepondre,
  onRejoindre,
  onRepondre,
}: {
  onRetourCours?: () => void
  partie: Partie
  ecartMs: number
  envoi: boolean
  ecoule: boolean
  peutRepondre: boolean
  onRejoindre: () => void
  onRepondre: (choix: number) => void
}) {
  if (partie.phase === 'terminee') return <Fin partie={partie} onRetourCours={onRetourCours} />

  if (!partie.rejoint) {
    return (
      <section className="quiz__carte">
        <p className="quiz__surtitre">Quiz en direct</p>
        <h1>{partie.titre}</h1>
        <p className="quiz__aide">
          {partie.phase === 'attente'
            ? 'Le professeur attend que la classe rejoigne la partie.'
            : 'La partie a commencé : tu peux la rejoindre en cours de route.'}
        </p>
        <button
          type="button"
          className="bouton bouton--primaire"
          onClick={onRejoindre}
          disabled={envoi}
        >
          Rejoindre la partie
        </button>
        {partie.phase === 'attente' && partie.joueurs.length > 0 && (
          <SalleDAttente partie={partie} />
        )}
      </section>
    )
  }

  if (partie.phase === 'attente' || !partie.question) {
    return (
      <section className="quiz__carte">
        <p className="quiz__surtitre">Quiz en direct</p>
        <h1>{partie.titre}</h1>
        <p className="quiz__aide">
          Tu es dans la partie. La première question arrive quand le professeur la lance.
        </p>
        <SalleDAttente partie={partie} />
      </section>
    )
  }

  const question = partie.question
  const corrigee = partie.phase === 'correction'

  return (
    <section className="quiz__question" aria-labelledby="enonce-quiz">
      <header className="quiz__entete">
        <p className="quiz__surtitre">
          Question {question.rang + 1} sur {question.total}
        </p>
        {!corrigee && (
          <CompteARebours finA={question.fin_a} ecartMs={ecartMs} dureeS={question.duree_s} />
        )}
      </header>

      <h1 id="enonce-quiz" className="quiz__enonce">
        {question.enonce}
      </h1>
      {question.code && (
        <CarteCode>
          <pre>{question.code}</pre>
        </CarteCode>
      )}

      <OptionsQuiz
        options={question.options}
        // Toujours des boutons pendant la question, désactivés une fois la
        // réponse partie ou le temps écoulé : ils disent « plus maintenant ».
        onChoisir={onRepondre}
        verrouille={!peutRepondre}
        choisi={partie.ma_reponse?.choix ?? null}
        bonneReponse={corrigee ? question.bonne_reponse : undefined}
      />

      {!corrigee && partie.ma_reponse && (
        <p className="quiz__statut" role="status">
          Réponse enregistrée. La correction arrive à la fin du temps.
        </p>
      )}
      {!corrigee && !partie.ma_reponse && (
        <p className="quiz__statut">
          {ecoule
            ? 'Temps écoulé.'
            : `Clique sur ta réponse, ou tape 1 à ${question.options.length}.`}
        </p>
      )}

      {corrigee && <Correction partie={partie} />}
    </section>
  )
}

/** Qui est déjà là : les mêmes ronds et les mêmes noms qu'au mur. */
function SalleDAttente({ partie }: { partie: Partie }) {
  return (
    <PastillesJoueurs
      joueurs={partie.joueurs.map((joueur, rang) => ({
        cle: `${rang}-${joueur.nom}`,
        nom: joueur.nom,
        moi: joueur.moi,
      }))}
    />
  )
}

function Correction({ partie }: { partie: Partie }) {
  const mienne = partie.ma_reponse
  const question = partie.question!
  const verdict = !mienne
    ? { ton: 'neutre', texte: 'Pas de réponse à temps pour celle-ci.' }
    : mienne.correcte
      ? { ton: 'juste', texte: `Juste : +${nombre(mienne.points ?? 0)} points.` }
      : { ton: 'faux', texte: 'Pas cette fois.' }

  return (
    <div className="quiz__correction">
      <p className="quiz__verdict" data-ton={verdict.ton} role="status">
        {verdict.texte}
      </p>
      {question.explication && <p className="quiz__explication">{question.explication}</p>}
      {partie.moi && <MonScore moi={partie.moi} />}
    </div>
  )
}

function MonScore({ moi }: { moi: NonNullable<Partie['moi']> }) {
  return (
    <p className="quiz__score">
      <b>{accord(moi.points, 'point', 'points')}</b>
      {moi.rang !== null && (
        <span>
          {' '}
          · {rang(moi.rang)} sur {moi.participants}
        </span>
      )}
    </p>
  )
}

function Fin({ partie, onRetourCours }: { partie: Partie; onRetourCours?: () => void }) {
  const moi = partie.moi
  return (
    <section className="quiz__carte">
      <p className="quiz__surtitre">Partie terminée</p>
      <h1>{partie.titre}</h1>
      {moi ? (
        <>
          <p className="quiz__bilan">
            {accord(moi.bonnes, 'bonne réponse', 'bonnes réponses')} sur {moi.questions_closes}
          </p>
          <MonScore moi={moi} />
          <p className="quiz__aide">
            Ce score reste dans la partie : il ne compte ni dans ta progression, ni ailleurs.
          </p>
        </>
      ) : (
        <p className="quiz__aide">Tu n'as pas joué cette partie.</p>
      )}
      <RetourCours onRetourCours={onRetourCours} />
    </section>
  )
}

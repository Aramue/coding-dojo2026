import { useEffect, useState } from 'react'
import { listerEleves } from '../prof/classe'
import {
  corriger,
  creerPartie,
  SessionProfRefusee,
  lirePartie,
  lireResultats,
  listerQuiz,
  questionSuivante,
  terminerPartie,
} from '../prof/quiz'
import { nommer } from '../prof/seance'
import type {
  DernierePartie,
  EtatProf,
  LigneBilan,
  Participant,
  PlaceProjetee,
  ResultatsQuiz,
  ResumeQuiz,
} from '../quiz/types'
import { useFluxQuiz } from '../quiz/useFluxQuiz'
import { naviguer } from '../routage'
import { CarteCode } from './CarteCode'
import { CompteARebours } from './CompteARebours'
import { LETTRES } from './FormeOption'
import { OptionsQuiz } from './OptionsQuiz'
import { PastillesJoueurs } from './PastillesJoueurs'
import './Quiz.css'
import './QuizProf.css'

type Partie = Exclude<EtatProf, { partie: null }>

/** En dessous, la question mérite d'être reprise en classe. */
const SEUIL_A_REPRENDRE = 0.5

function accord(n: number, un: string, plusieurs: string): string {
  return `${n.toLocaleString('fr-CH')} ${n <= 1 ? un : plusieurs}`
}

/**
 * Le nom qu'on projette. Comme `nommer`, sauf le repli : sans prénom, le
 * tableau de bord montre le code d'accès — utile au professeur seul — mais
 * cet écran est au mur, et le code est le secret de l'élève.
 */
function nomProjete(eleve: Participant): string {
  return eleve.prenom?.trim() ? nommer(eleve) : 'Élève'
}

function pourcent(part: number | null): string {
  return part === null ? '—' : `${Math.round(part * 100)} %`
}

function date(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })
}

/**
 * Le quiz, vu par le professeur — donc par toute la salle : cet écran est
 * projeté.
 *
 * Deux conséquences, tenues par le serveur et respectées ici :
 * - la bonne réponse n'arrive qu'à la correction, jamais pendant la question ;
 * - le classement s'arrête aux cinq premiers et ne montre personne à zéro.
 * Voir ADR-015.
 */
export function QuizProf({
  jetonProf,
  onRefuse,
}: {
  jetonProf: string
  /** Le jeton est refusé (expiré, compte recréé) : on rend la main à la porte. */
  onRefuse?: () => void
}) {
  function surveiller<T>(action: () => Promise<T>): () => Promise<T> {
    return async () => {
      try {
        return await action()
      } catch (e) {
        if (e instanceof SessionProfRefusee) onRefuse?.()
        throw e
      }
    }
  }

  const { etat, ecartMs, erreur, flux } = useFluxQuiz<EtatProf>(
    surveiller(() => lirePartie(jetonProf)),
    // Le jeton dans le premier message, jamais dans l'URL. Voir ADR-016.
    () => ({ jeton_prof: jetonProf }),
  )
  const [refus, setRefus] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [nouvelle, setNouvelle] = useState(false)
  const [inscrits, setInscrits] = useState<number | null>(null)
  const [resultatsDe, setResultatsDe] = useState<string | null>(null)

  useEffect(() => {
    // Le nombre d'inscrits, pour lire « 18 sur 24 » plutôt que « 18 ». Sans
    // lui l'écran se contente du compte : dégradé, jamais cassé.
    listerEleves(jetonProf)
      .then((eleves) => setInscrits(eleves.length))
      .catch(() => setInscrits(null))
  }, [jetonProf])

  async function agir(action: () => Promise<EtatProf>) {
    setEnvoi(true)
    const envoiA = Date.now()
    try {
      flux.recevoir(await surveiller(action)(), envoiA)
      setRefus(null)
      setNouvelle(false)
    } catch (e) {
      setRefus(e instanceof Error ? e.message : 'Action impossible.')
      void flux.relire()
    } finally {
      setEnvoi(false)
    }
  }

  const partie = etat && etat.partie !== null ? (etat as Partie) : null

  // La partie que cet écran a vue en cours. Sa fin mérite le podium, projeté
  // au moment où la classe le découvre ; une partie finie AVANT l'ouverture
  // de la page, elle, n'accueille plus personne — ses résultats restent dans
  // « Derniers résultats ».
  const [suivie, setSuivie] = useState<number | null>(null)
  const enCours = partie !== null && partie.phase !== 'terminee' ? partie.partie : null
  useEffect(() => {
    if (enCours !== null) setSuivie(enCours)
  }, [enCours])

  const finEnDirect =
    partie?.phase === 'terminee' &&
    suivie === partie.partie &&
    // Arrêtée sans une seule réponse, il n'y a ni podium ni bilan à montrer.
    (partie.bilan ?? []).some((ligne) => ligne.reponses > 0)
  const choisir =
    etat !== null && (!partie || nouvelle || (partie.phase === 'terminee' && !finEnDirect))

  return (
    <main className="quiz-prof">
      <div className="quiz-prof__fil">
        <button
          type="button"
          className="bouton quiz-prof__retour"
          onClick={() => naviguer({ vue: 'prof' })}
        >
          <FlecheRetour />
          Retour au tableau de bord
        </button>
      </div>

      {(refus || erreur) && (
        <p role="alert" className="quiz__alerte">
          {refus ?? erreur}
        </p>
      )}

      {!etat && <p className="quiz__attente">Chargement…</p>}
      {choisir && resultatsDe && (
        <Resultats jetonProf={jetonProf} quizId={resultatsDe} onRetour={() => setResultatsDe(null)} />
      )}
      {choisir && !resultatsDe && (
        <Catalogue
          jetonProf={jetonProf}
          envoi={envoi}
          onLancer={(id) => void agir(() => creerPartie(jetonProf, id))}
          onResultats={setResultatsDe}
        />
      )}
      {partie && !choisir && (
        <Deroule
          partie={partie}
          ecartMs={ecartMs}
          inscrits={inscrits}
          envoi={envoi}
          onSuivante={() => void agir(() => questionSuivante(jetonProf, partie.question?.rang ?? -1))}
          onCorriger={() => partie.question && void agir(() => corriger(jetonProf, partie.question!.rang))}
          onTerminer={() => void agir(() => terminerPartie(jetonProf))}
          onNouvelle={() => setNouvelle(true)}
        />
      )}
    </main>
  )
}

function Catalogue({
  jetonProf,
  envoi,
  onLancer,
  onResultats,
}: {
  jetonProf: string
  envoi: boolean
  onLancer: (id: string) => void
  onResultats: (id: string) => void
}) {
  const [quiz, setQuiz] = useState<ResumeQuiz[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    listerQuiz(jetonProf)
      .then(setQuiz)
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : 'Catalogue indisponible.'))
  }, [jetonProf])

  return (
    <section className="quiz-prof__catalogue" aria-labelledby="titre-catalogue">
      <h1 id="titre-catalogue">Lancer un quiz</h1>
      <p className="quiz__aide">
        Les élèves rejoignent depuis leur espace : un bandeau les y invite dès que la partie est
        créée. Le classement ne montre que les cinq premiers, et le score ne compte nulle part
        ailleurs.
      </p>
      {erreur && <p className="quiz__aide">{erreur}</p>}
      {quiz && quiz.length === 0 && (
        <p className="quiz__aide">
          Aucun quiz n'est construit sur ce serveur. Ils s'écrivent dans{' '}
          <code className="mono">contenu/chapitre-1/quiz/</code> et se construisent au déploiement.
        </p>
      )}
      {quiz && quiz.length > 0 && (
        <ul className="quiz-prof__liste">
          {quiz.map((q) => (
            <li key={q.id} className="quiz-prof__ligne">
              <span className="quiz-prof__nom">
                <b>{q.titre}</b>
                <span>
                  {accord(q.questions, 'question', 'questions')} · environ{' '}
                  {Math.max(1, Math.round(q.duree_s / 60))} min de réponse
                </span>
                <span className="quiz-prof__derniere">
                  {q.derniere ? <ResumeDerniere derniere={q.derniere} /> : 'Pas encore joué'}
                </span>
              </span>
              {q.derniere && (
                <button type="button" className="bouton" onClick={() => onResultats(q.id)}>
                  Derniers résultats
                </button>
              )}
              <button
                type="button"
                className="bouton bouton--primaire"
                disabled={envoi}
                onClick={() => onLancer(q.id)}
              >
                Lancer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ResumeDerniere({ derniere }: { derniere: DernierePartie }) {
  return (
    <>
      Dernière partie le {date(derniere.terminee_le)} :{' '}
      <b>{pourcent(derniere.reussite)}</b> de bonnes réponses,{' '}
      {accord(derniere.joueurs, 'élève', 'élèves')}
    </>
  )
}

/**
 * Les résultats de la dernière partie jouée d'un quiz, relus après coup.
 *
 * Le taux de réussite d'abord — c'est le chiffre qu'on compare d'une partie à
 * l'autre —, puis le bilan anonyme, question par question.
 */
function Resultats({
  jetonProf,
  quizId,
  onRetour,
}: {
  jetonProf: string
  quizId: string
  onRetour: () => void
}) {
  const [resultats, setResultats] = useState<ResultatsQuiz | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    lireResultats(jetonProf, quizId)
      .then(setResultats)
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : 'Résultats indisponibles.'))
  }, [jetonProf, quizId])

  return (
    <section className="quiz-prof__resultats" aria-labelledby="titre-resultats">
      <p className="quiz__surtitre">Derniers résultats</p>
      <h1 id="titre-resultats">{resultats?.titre ?? 'Résultats'}</h1>
      {erreur && <p className="quiz__aide">{erreur}</p>}
      {resultats && (
        <>
          <p className="quiz-prof__taux">
            <b>{pourcent(resultats.reussite)}</b>
            <span>
              de bonnes réponses, le {date(resultats.terminee_le)} ·{' '}
              {accord(resultats.joueurs, 'élève', 'élèves')},{' '}
              {accord(resultats.reponses, 'réponse', 'réponses')}
            </span>
          </p>
          <Bilan lignes={resultats.bilan} />
        </>
      )}
      <div className="quiz-prof__actions">
        <button type="button" className="bouton" onClick={onRetour}>
          Revenir aux quiz
        </button>
      </div>
    </section>
  )
}

function Deroule({
  partie,
  ecartMs,
  inscrits,
  envoi,
  onSuivante,
  onCorriger,
  onTerminer,
  onNouvelle,
}: {
  partie: Partie
  ecartMs: number
  inscrits: number | null
  envoi: boolean
  onSuivante: () => void
  onCorriger: () => void
  onTerminer: () => void
  onNouvelle: () => void
}) {
  const [confirmer, setConfirmer] = useState(false)
  const question = partie.question

  let corps
  if (partie.phase === 'terminee') {
    corps = <Fin partie={partie} onNouvelle={onNouvelle} />
  } else if (partie.phase === 'attente' || !question) {
    corps = (
      <section className="quiz-prof__attente" aria-labelledby="titre-partie">
        <p className="quiz__surtitre">Salle d'attente</p>
        <h1 id="titre-partie">{partie.titre}</h1>
        <PastillesJoueurs
          titre="Élèves dans la partie"
          sur={inscrits}
          joueurs={partie.participants.map((p) => ({ cle: p.code_acces, nom: nomProjete(p) }))}
        />
        <p className="quiz__aide">
          Un bandeau « Un quiz a commencé » est apparu dans l'espace de chaque élève. On peut aussi
          rejoindre en cours de partie.
        </p>
        <div className="quiz-prof__actions">
          <button type="button" className="bouton bouton--primaire" disabled={envoi} onClick={onSuivante}>
            Lancer la première question
          </button>
        </div>
      </section>
    )
  } else {
    const corrigee = partie.phase === 'correction'
    corps = (
      <section className="quiz-prof__question" aria-labelledby="enonce-projete">
        <header className="quiz__entete">
          <p className="quiz__surtitre">
            Question {question.rang + 1} sur {question.total}
            {corrigee && ' · correction'}
          </p>
          {!corrigee && (
            <CompteARebours finA={question.fin_a} ecartMs={ecartMs} dureeS={question.duree_s} />
          )}
        </header>

        <div className="quiz-prof__grille">
          <div className="quiz-prof__principal">
            <h1 id="enonce-projete" className="quiz-prof__enonce">
              {question.enonce}
            </h1>
            {question.code && (
              <CarteCode>
                <pre>{question.code}</pre>
              </CarteCode>
            )}
            <OptionsQuiz
              options={question.options}
              bonneReponse={corrigee ? question.bonne_reponse : undefined}
              repartition={corrigee ? partie.repartition : null}
            />
            {corrigee && question.explication && (
              <p className="quiz-prof__explication">{question.explication}</p>
            )}
          </div>

          {corrigee && partie.podium.length > 0 && (
            <aside className="quiz-prof__cote" aria-labelledby="titre-podium">
              <h2 id="titre-podium">En tête</h2>
              <Podium places={partie.podium} />
            </aside>
          )}
        </div>

        <div className="quiz-prof__actions">
          <p className="quiz-prof__effectif" role="status">
            {partie.reponses_recues} {partie.reponses_recues <= 1 ? 'réponse' : 'réponses'} sur{' '}
            {partie.participants.length}
          </p>
          {corrigee ? (
            <button type="button" className="bouton bouton--primaire" disabled={envoi} onClick={onSuivante}>
              {partie.derniere ? 'Voir le résultat final' : 'Question suivante'}
            </button>
          ) : (
            <button type="button" className="bouton" disabled={envoi} onClick={onCorriger}>
              Corriger maintenant
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <>
      {corps}
      {partie.phase !== 'terminee' && (
        <div className="quiz-prof__pied">
          {confirmer ? (
            <>
              <span>La partie s'arrête pour tout le monde, et ne reprend pas.</span>
              <button type="button" className="bouton" onClick={() => setConfirmer(false)}>
                Continuer la partie
              </button>
              <button
                type="button"
                className="bouton bouton--sombre"
                disabled={envoi}
                onClick={() => {
                  setConfirmer(false)
                  onTerminer()
                }}
              >
                Arrêter la partie
              </button>
            </>
          ) : (
            <button type="button" className="bouton" onClick={() => setConfirmer(true)}>
              Terminer la partie
            </button>
          )}
        </div>
      )}
    </>
  )
}

function FlecheRetour() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Podium({ places }: { places: PlaceProjetee[] }) {
  return (
    <ol className="podium">
      {places.map((place) => (
        <li key={place.code_acces} className="podium__place">
          <span className="podium__rang">{place.rang}</span>
          <span className="podium__nom">{nomProjete(place)}</span>
          <span className="podium__points">{place.points.toLocaleString('fr-CH')}</span>
        </li>
      ))}
    </ol>
  )
}

function Fin({ partie, onNouvelle }: { partie: Partie; onNouvelle: () => void }) {
  return (
    <section className="quiz-prof__fin" aria-labelledby="titre-fin">
      <p className="quiz__surtitre">Partie terminée</p>
      <h1 id="titre-fin">{partie.titre}</h1>

      {partie.podium.length > 0 ? (
        <Podium places={partie.podium} />
      ) : (
        <p className="quiz__aide">Personne n'a marqué de point dans cette partie.</p>
      )}

      {partie.bilan && partie.bilan.length > 0 && <Bilan lignes={partie.bilan} />}

      <div className="quiz-prof__actions">
        <button type="button" className="bouton bouton--primaire" onClick={onNouvelle}>
          Nouvelle partie
        </button>
      </div>
    </section>
  )
}

/**
 * Ce que le professeur garde de la partie : question par question, ce que la
 * classe a répondu. Anonyme — le serveur ne l'envoie pas autrement.
 */
function Bilan({ lignes }: { lignes: LigneBilan[] }) {
  return (
    <section className="bilan" aria-labelledby="titre-bilan">
      <h2 id="titre-bilan">Question par question</h2>
      <ol className="bilan__liste">
        {lignes.map((ligne) => {
          const justes = ligne.repartition[ligne.bonne_reponse] ?? 0
          const part = ligne.reponses > 0 ? justes / ligne.reponses : 0
          const aReprendre = ligne.reponses > 0 && part < SEUIL_A_REPRENDRE
          return (
            <li key={ligne.rang} className="bilan__ligne">
              <div className="bilan__entete">
                <span className="bilan__numero">Q{ligne.rang + 1}</span>
                <span className="bilan__enonce">{ligne.enonce}</span>
                {aReprendre && <span className="bilan__reprendre">À reprendre</span>}
                <span className="bilan__taux">
                  {ligne.reponses > 0
                    ? `${Math.round(part * 100)} % de bonnes réponses (${justes} sur ${ligne.reponses})`
                    : 'Aucune réponse'}
                </span>
              </div>
              {ligne.code && <pre className="bilan__code mono">{ligne.code}</pre>}
              <ul className="bilan__repartition">
                {ligne.options.map((option, rang) => (
                  <li
                    key={rang}
                    data-option={rang}
                    data-bonne={rang === ligne.bonne_reponse || undefined}
                  >
                    <span className="bilan__lettre">{LETTRES[rang]}</span>
                    <span className="bilan__option">{option}</span>
                    <span className="bilan__compte">{ligne.repartition[rang] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

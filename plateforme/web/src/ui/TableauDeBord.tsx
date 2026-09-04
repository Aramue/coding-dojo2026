import { useEffect, useId, useMemo, useState } from 'react'
import { useContenuPublie } from '../prof/contenu'
import {
  blocagesCollectifs,
  nommer,
  obligatoires,
  parcoursEleve,
  reperes,
  synthese,
  type LigneEleve,
  type NotionEleve,
  type Repere,
} from '../prof/seance'
import type { Destination } from '../routage'
import './TableauDeBord.css'

const LIBELLES: Record<LigneEleve['statut'], string> = {
  bloque: 'Bloqué',
  inactif: 'Inactif',
  pas_commence: 'Pas commencé',
  en_cours: 'En cours',
}

const PERIODE_MS = 10_000

/** « il y a 3 min », ou rien du tout en dessous d'une minute. */
function minutes(secondes: number): string | null {
  const m = Math.floor(secondes / 60)
  return m < 1 ? null : `${m} min`
}

function accord(nombre: number, singulier: string, pluriel: string): string {
  return `${nombre} ${nombre <= 1 ? singulier : pluriel}`
}

export function TableauDeBord({
  codeProf,
  onApercu,
}: {
  codeProf: string
  /** Ouvre l'aperçu de l'espace élève sur une page précise. */
  onApercu?: (ou: Destination) => void
}) {
  const [eleves, setEleves] = useState<LigneEleve[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [recuA, setRecuA] = useState<number | null>(null)

  // Le contenu publié, pour lire des titres au lieu d'identifiants. Sans lui le
  // tableau affiche des identifiants bruts : dégradé, jamais cassé.
  const contenu = useContenuPublie()

  useEffect(() => {
    let vivant = true
    async function rafraichir() {
      try {
        const reponse = await fetch('/api/prof/seance', { headers: { 'X-Code-Prof': codeProf } })
        if (!reponse.ok) throw new Error('Accès refusé.')
        const donnees = await reponse.json()
        // Une réponse sans `eleves` mettait `undefined` dans l'état, et le
        // rendu plantait sur `.length` : ==le tableau du professeur devenait
        // un écran blanc== en pleine séance, sans rien qui explique pourquoi.
        if (!Array.isArray(donnees?.eleves)) {
          throw new Error('Réponse inattendue de la plateforme.')
        }
        if (vivant) {
          setEleves(donnees.eleves)
          setRecuA(Date.now())
          setErreur(null)
        }
      } catch (e) {
        if (vivant) setErreur(e instanceof Error ? e.message : 'Erreur réseau.')
      }
    }
    rafraichir()
    const minuteur = setInterval(rafraichir, PERIODE_MS)
    return () => {
      vivant = false
      clearInterval(minuteur)
    }
  }, [codeProf])

  const titres = useMemo(
    () => (contenu ? reperes(contenu.exercices, contenu.notions) : new Map<string, Repere>()),
    [contenu],
  )
  const comptes = useMemo(
    () => (contenu ? obligatoires(contenu.exercices) : new Set<string>()),
    [contenu],
  )
  const vue = useMemo(() => synthese(eleves, comptes), [eleves, comptes])
  const blocages = useMemo(() => blocagesCollectifs(eleves), [eleves])

  return (
    <main className="tableau">
      {/*
        Une bande qui suit le défilement : vingt-quatre lignes font deux écrans,
        et ==les compteurs doivent rester lisibles pendant qu'on parcourt la
        liste==. C'est eux qu'on relit toutes les deux minutes, pas le titre.
      */}
      <header className="tableau__entete">
        <div className="tableau__titre">
          <h1>Séance en cours</h1>
          <p className="tableau__effectif">
            {accord(eleves.length, 'élève connecté', 'élèves connectés')}
          </p>
        </div>

        {eleves.length > 0 && (
          <div className="tableau__comptes" aria-label="Répartition de la classe">
            <Compte valeur={vue.bloques} un="bloqué" plusieurs="bloqués" ton="bloque" />
            <Compte valeur={vue.inactifs} un="inactif" plusieurs="inactifs" ton="inactif" />
            <Compte
              valeur={vue.pasCommence}
              un="pas commencé"
              plusieurs="pas commencé"
              ton="pas_commence"
            />
            <Compte valeur={vue.enCours} un="en cours" plusieurs="en cours" ton="en_cours" />
          </div>
        )}

        <Pouls recuA={recuA} enErreur={Boolean(erreur)} />
      </header>

      {erreur && <p role="alert">{erreur}</p>}

      {eleves.length > 0 && vue.total > 0 && (
        <section className="avancement" aria-label="Avancement de la classe">
          <p className="avancement__legende">
            Avancement de la classe — médiane <b>{vue.mediane}</b> sur {vue.total} obligatoires
          </p>
          <Etalement avancements={vue.avancements} total={vue.total} />
        </section>
      )}

      {blocages.length > 0 && (
        <section className="blocages" aria-labelledby="titre-blocages">
          <h2 id="titre-blocages" className="blocages__titre">
            Ce qui bloque plusieurs élèves
          </h2>
          {blocages.map((blocage) => {
            const repere = titres.get(blocage.exerciceId)
            return (
              <article key={blocage.exerciceId} className="blocage">
                <span className="blocage__compte">{blocage.eleves.length}</span>
                <div className="blocage__texte">
                  <b>{repere ? repere.titre : blocage.exerciceId}</b>
                  <span className="blocage__notion">
                    {repere?.notion}
                    {blocage.erreurs.length > 0 && ` — ${blocage.erreurs.join(', ')}`}
                  </span>
                </div>
                <span className="blocage__codes mono">{blocage.eleves.join(' · ')}</span>
              </article>
            )
          })}
        </section>
      )}

      <div className="tableau__lignes">
        {eleves.map((eleve) => (
          <Ligne
            key={eleve.code_acces}
            eleve={eleve}
            repere={eleve.exercice_id ? titres.get(eleve.exercice_id) : undefined}
            comptes={comptes}
            total={vue.total}
            parcours={
              contenu ? parcoursEleve(eleve, contenu.exercices, contenu.notions) : undefined
            }
            onApercu={onApercu}
          />
        ))}
      </div>
    </main>
  )
}

/**
 * Le signe que la page est vivante.
 *
 * En classe, un tableau figé et une classe silencieuse se ressemblent trait
 * pour trait. Sans ce point qui bat, le professeur ne peut pas distinguer
 * « personne ne soumet rien » de « la page ne se met plus à jour ».
 */
function Pouls({ recuA, enErreur }: { recuA: number | null; enErreur: boolean }) {
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(minuteur)
  }, [])

  if (enErreur) return <span className="pouls pouls--rompu">plus de données</span>
  if (recuA === null) return <span className="pouls pouls--attente">connexion…</span>

  const secondes = Math.max(0, Math.round((maintenant - recuA) / 1000))
  return (
    <span className="pouls">
      {secondes < 2 ? "à l'instant" : `il y a ${secondes} s`}
    </span>
  )
}

/** Un point, un nombre, un mot. « 1 inactifs » se remarque tout de suite. */
function Compte({
  valeur,
  un,
  plusieurs,
  ton,
}: {
  valeur: number
  un: string
  plusieurs: string
  ton: LigneEleve['statut']
}) {
  return (
    <span className="compte" data-ton={ton} data-vide={valeur === 0}>
      <b>{valeur}</b> {valeur <= 1 ? un : plusieurs}
    </span>
  )
}

/**
 * Un trait par élève, posé là où il en est.
 *
 * Une moyenne dirait « la classe est à 9 » et laisserait croire à un groupe
 * homogène. ==C'est l'écart qui se pilote== : voir six traits collés à gauche
 * pendant que trois touchent la fin, c'est savoir qu'il faut aller au fond de
 * la salle plutôt que ralentir tout le monde.
 */
function Etalement({ avancements, total }: { avancements: number[]; total: number }) {
  return (
    <div
      className="etalement"
      role="img"
      aria-label={`Répartition des ${avancements.length} élèves, de ${avancements[0] ?? 0} à ${
        avancements[avancements.length - 1] ?? 0
      } exercices réussis sur ${total}`}
    >
      {avancements.map((fait, index) => (
        <span
          key={index}
          className="etalement__trait"
          style={{ left: `${total === 0 ? 0 : (fait / total) * 100}%` }}
        />
      ))}
    </div>
  )
}

function Ligne({
  eleve,
  repere,
  comptes,
  total,
  parcours,
  onApercu,
}: {
  eleve: LigneEleve
  repere?: Repere
  comptes: Set<string>
  total: number
  /** Le parcours détaillé. Absent tant que le contenu publié n'est pas chargé. */
  parcours?: NotionEleve[]
  onApercu?: (ou: Destination) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const idDetail = useId()
  const depuis = minutes(eleve.inactif_depuis_s)
  const faits = eleve.reussis.filter((r) => comptes.has(r.exercice_id)).length

  return (
    <article className={`ligne ligne--${eleve.statut}`} data-ouvert={ouvert}>
      {/*
        Le nom quand il existe, le code sinon. Le professeur cherche quelqu'un
        dans une salle : « Camille R. » se dit à voix haute, « DOJO-K7M2 » non.
      */}
      <span className="ligne__eleve" data-anonyme={!eleve.prenom}>
        <span className="ligne__nom">{nommer(eleve)}</span>
        {/*
          La meme jauge que l'eleve a en haut de son ecran, en petit. Le chiffre
          seul se lit ligne par ligne ; ==la barre se lit en balayant la
          colonne==, et c'est ainsi qu'on repere qui traine.
        */}
        {total > 0 && <Jauge faits={faits} total={total} />}
      </span>
      <span className="ligne__ou">
        {eleve.exercice_id === null ? (
          <b className="ligne__attente">aucune soumission</b>
        ) : (
          <>
            <b>{repere ? repere.titre : eleve.exercice_id}</b>
            {repere && <span className="ligne__notion">{repere.notion}</span>}
          </>
        )}
      </span>
      <span className="ligne__quoi">
        {eleve.statut === 'bloque' &&
          `${accord(eleve.echecs_consecutifs, 'échec', "échecs d'affilée")}${
            eleve.dernier_type_erreur ? ` — ${eleve.dernier_type_erreur}` : ''
          }`}
        {/* Le délai d'un inactif EST son information : il porte le libellé complet. */}
        {eleve.statut === 'inactif' && `aucune soumission depuis ${depuis ?? "moins d'une minute"}`}
        {eleve.statut === 'pas_commence' &&
          (depuis ? `code créé, jamais utilisé depuis ${depuis}` : 'code créé à l’instant')}
        {/*
          La jauge dit déjà « 12/25 » : le répéter ici ne rajoute rien. Le
          délai, lui, distingue celui qui vient de valider de celui qui sèche
          en silence sans avoir encore atteint le seuil d'inactivité.
        */}
        {eleve.statut === 'en_cours' &&
          (depuis ? `dernière soumission il y a ${depuis}` : 'vient de soumettre')}
      </span>
      <span className={`statut statut--${eleve.statut}`}>
        {LIBELLES[eleve.statut]}
        {/* « Bloqué 0 min » ne veut rien dire : le délai ne s'affiche que s'il compte. */}
        {eleve.statut === 'bloque' && depuis && ` · ${depuis}`}
      </span>

      <button
        type="button"
        className="ligne__deplier"
        aria-expanded={ouvert}
        aria-controls={idDetail}
        onClick={() => setOuvert((o) => !o)}
      >
        <span className="sr-only">
          {ouvert ? 'Replier' : 'Déplier'} le parcours de {nommer(eleve)}
        </span>
        <Chevron ouvert={ouvert} />
      </button>

      {ouvert && (
        <div className="detail" id={idDetail}>
          {parcours ? (
            <Parcours notions={parcours} onApercu={onApercu} />
          ) : (
            <p className="detail__vide">Chargement…</p>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * Le parcours d'un élève, notion par notion.
 *
 * > [!important] Ce que ce panneau ne montre pas, et ne montrera pas
 * > ==Rien de ce que l'élève a tapé.== Ni son code, ni ses réponses, ni les
 * > valeurs qu'il a saisies. L'API n'en transporte aucune — voir ADR-001 :
 * > le code s'exécute dans le navigateur de l'élève et n'en sort jamais. Ce
 * > panneau dit *où* il en est, jamais *ce qu'il écrit*.
 */
function Parcours({
  notions,
  onApercu,
}: {
  notions: NotionEleve[]
  onApercu?: (ou: Destination) => void
}) {
  return (
    <div className="parcours">
      {notions.map((notion) => (
        <section key={notion.id} className="parcours__notion">
          <h3 className="parcours__titre">
            <span>{notion.titre}</span>
            {notion.total > 0 && (
              <span className="parcours__compte">
                {notion.faits}/{notion.total}
              </span>
            )}
          </h3>
          {/* La même jauge que dans le sommaire de l'élève, notion par notion. */}
          {notion.total > 0 && <Jauge faits={notion.faits} total={notion.total} discrete />}
          <ul className="parcours__etapes">
            {notion.etapes.map((etape) => (
              <li
                key={etape.id}
                className="etape"
                data-coches={etape.coches}
                data-courant={etape.courant}
                data-bonus={!etape.obligatoire}
              >
                {/*
                  La même coche que l'élève voit dans sa liste, tracée à la
                  main comme le reste. ==Un « ✓ » de la police est un caractère,
                  pas une icône== : son dessin change d'une machine à l'autre et
                  ne se cale ni sur la graisse ni sur la couleur autour.
                */}
                <span className="etape__marque" aria-hidden="true">
                  {etape.coches === 0 ? <Point /> : <Coche />}
                  {etape.coches === 2 && <Coche />}
                </span>
                {/*
                  Le titre ouvre l'exercice tel que l'eleve le voit. Sans cela,
                  le professeur sait qu'on bute sur « L'age qui refuse de
                  s'additionner » sans pouvoir relire ce que l'enonce demande.
                  Quatre colonnes serrees coupent les titres longs : le survol
                  rend le titre entier sans elargir le panneau.
                */}
                <button
                  type="button"
                  className="etape__titre"
                  title={`${etape.titre} — voir l'exercice`}
                  disabled={!onApercu}
                  onClick={() =>
                    onApercu?.({ vue: 'exercice', notion: notion.id, numero: etape.numero })
                  }
                >
                  {etape.titre}
                </button>
                {etape.courant && <span className="etape__ici">en ce moment</span>}
                {!etape.obligatoire && <span className="etape__bonus">facultatif</span>}
                <span className="sr-only">
                  {etape.coches === 2
                    ? 'réussi, méthode maîtrisée'
                    : etape.coches === 1
                      ? 'réussi'
                      : 'pas encore'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="parcours__garde">
        Le code écrit par l'élève ne quitte jamais son navigateur : cette vue dit où il en est,
        pas ce qu'il tape.
      </p>
    </div>
  )
}

/**
 * La jauge de progression, celle que l'élève a en haut de son écran.
 *
 * Elle ne compte que les obligatoires — [[ADR-004]] : un bonus n'entre jamais
 * dans la progression affichée, ni chez l'élève ni ici. Les deux doivent dire
 * le même chiffre, sinon le professeur annonce à la classe une avance qu'elle
 * ne voit pas.
 */
function Jauge({
  faits,
  total,
  discrete = false,
}: {
  faits: number
  total: number
  /** Sans le compte à côté : le titre le porte déjà. */
  discrete?: boolean
}) {
  return (
    <span className="jauge" data-discrete={discrete}>
      <span
        className="jauge__piste"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={faits}
        aria-label={`${faits} exercices réussis sur ${total}`}
      >
        <span className="jauge__part" style={{ width: `${(faits / total) * 100}%` }} />
      </span>
      {!discrete && (
        <span className="jauge__compte">
          {faits}/{total}
        </span>
      )}
    </span>
  )
}

/* SVG tracés à la main, trait 2,2 : la charte interdit emoji et icônes importées. */

function Coche() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Pas encore fait : un point, pas un vide — la ligne garde son alignement. */
function Point() {
  return (
    <svg viewBox="0 0 24 24" width="6" height="6" aria-hidden="true">
      <circle cx="12" cy="12" r="6" fill="currentColor" />
    </svg>
  )
}

function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      className="ligne__chevron"
      data-ouvert={ouvert}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

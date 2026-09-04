import { useEffect, useMemo, useState } from 'react'
import { chargerNotions, chargerParcours } from '../contenu/chargeur'
import type { Exercice, Notion } from '../contenu/types'
import {
  blocagesCollectifs,
  obligatoires,
  reperes,
  synthese,
  type LigneEleve,
  type Repere,
} from '../prof/seance'
import './TableauDeBord.css'

const LIBELLES: Record<LigneEleve['statut'], string> = {
  bloque: 'Bloqué',
  inactif: 'Inactif',
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

export function TableauDeBord({ codeProf }: { codeProf: string }) {
  const [eleves, setEleves] = useState<LigneEleve[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [recuA, setRecuA] = useState<number | null>(null)
  const [contenu, setContenu] = useState<{ exercices: Exercice[]; notions: Notion[] } | null>(null)

  // Le contenu publié, pour lire des titres au lieu d'identifiants. Il est
  // statique : chargé une fois, jamais rafraîchi avec la séance.
  useEffect(() => {
    let vivant = true
    Promise.all([chargerParcours(), chargerNotions()])
      .then(([exercices, notions]) => {
        // Même garde que sur `eleves` : une réponse d'une autre forme mettrait
        // un non-tableau dans l'état, et le premier `.map` du rendu ferait du
        // tableau du professeur ==un écran blanc en pleine séance==.
        if (!Array.isArray(exercices) || !Array.isArray(notions)) return
        if (vivant) setContenu({ exercices, notions })
      })
      // Sans le contenu, le tableau affiche des identifiants bruts : c'est
      // dégradé, pas cassé. Il ne doit surtout pas disparaître pour autant.
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [])

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
      <header className="tableau__entete">
        <div>
          <h1>Séance en cours</h1>
          <p className="tableau__effectif">
            {accord(eleves.length, 'élève connecté', 'élèves connectés')}
          </p>
        </div>
        <Pouls recuA={recuA} enErreur={Boolean(erreur)} />
      </header>

      {erreur && <p role="alert">{erreur}</p>}

      {eleves.length > 0 && <Synthese vue={vue} />}

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
            repere={titres.get(eleve.exercice_id)}
            comptes={comptes}
            total={vue.total}
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

/** Où en est la classe : les trois statuts, et l'étalement des avancements. */
function Synthese({ vue }: { vue: ReturnType<typeof synthese> }) {
  return (
    <section className="synthese" aria-label="Vue d'ensemble de la classe">
      <div className="synthese__comptes">
        <Compte valeur={vue.bloques} libelle="bloqués" ton="bloque" />
        <Compte valeur={vue.inactifs} libelle="inactifs" ton="inactif" />
        <Compte valeur={vue.enCours} libelle="en cours" ton="en_cours" />
      </div>
      {vue.total > 0 && (
        <div className="synthese__avancement">
          <p className="synthese__legende">
            Avancement — médiane <b>{vue.mediane}</b> sur {vue.total} obligatoires
          </p>
          <Etalement avancements={vue.avancements} total={vue.total} />
        </div>
      )}
    </section>
  )
}

function Compte({
  valeur,
  libelle,
  ton,
}: {
  valeur: number
  libelle: string
  ton: LigneEleve['statut']
}) {
  return (
    <span className="compte" data-ton={ton} data-vide={valeur === 0}>
      <b>{valeur}</b> {libelle}
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
      <span className="etalement__bornes" aria-hidden="true">
        <span>0</span>
        <span>{total}</span>
      </span>
    </div>
  )
}

function Ligne({
  eleve,
  repere,
  comptes,
  total,
}: {
  eleve: LigneEleve
  repere?: Repere
  comptes: Set<string>
  total: number
}) {
  const depuis = minutes(eleve.inactif_depuis_s)
  const faits = eleve.reussis.filter((id) => comptes.has(id)).length

  return (
    <article className={`ligne ligne--${eleve.statut}`}>
      <span className="mono ligne__eleve">{eleve.code_acces}</span>
      <span className="ligne__ou">
        <b>{repere ? repere.titre : eleve.exercice_id}</b>
        {repere && <span className="ligne__notion">{repere.notion}</span>}
      </span>
      <span className="ligne__quoi">
        {eleve.statut === 'bloque' &&
          `${accord(eleve.echecs_consecutifs, 'échec', "échecs d'affilée")}${
            eleve.dernier_type_erreur ? ` — ${eleve.dernier_type_erreur}` : ''
          }`}
        {/* Le délai d'un inactif EST son information : il porte le libellé complet. */}
        {eleve.statut === 'inactif' && `aucune soumission depuis ${depuis ?? "moins d'une minute"}`}
        {eleve.statut === 'en_cours' &&
          (total > 0 ? `${faits} / ${total} réussis` : `${accord(faits, 'réussi', 'réussis')}`)}
      </span>
      <span className={`statut statut--${eleve.statut}`}>
        {LIBELLES[eleve.statut]}
        {/* « Bloqué 0 min » ne veut rien dire : le délai ne s'affiche que s'il compte. */}
        {eleve.statut === 'bloque' && depuis && ` · ${depuis}`}
      </span>
    </article>
  )
}

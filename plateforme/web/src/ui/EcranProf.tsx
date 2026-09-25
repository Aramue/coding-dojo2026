import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Executeur } from '../execution/executeur'
import { compteExiste, creerCompte, LONGUEUR_MIN, seConnecter } from '../prof/compte'
import type { Destination } from '../routage'
import { Apercu } from './Apercu'
import { Classe } from './Classe'
import { TableauDeBord } from './TableauDeBord'
import './EcranProf.css'

/**
 * La porte du tableau de bord.
 *
 * Au premier lancement, aucun compte n'existe : la porte propose de le créer.
 * Ensuite, elle demande le mot de passe et l'échange contre un jeton de douze
 * heures. C'est ce jeton qu'elle garde, le temps de l'onglet —
 * `sessionStorage`, jamais `localStorage`, parce que la machine de la salle
 * est partagée. Le mot de passe, lui, n'est gardé nulle part. Voir ADR-014.
 */
const CLE_PROF = 'dojo.jeton-prof'

const COMMANDE_OUBLI = 'docker compose exec api python -m app.oublier_prof'

function lireJetonMemorise(): string | null {
  try {
    return sessionStorage.getItem(CLE_PROF)
  } catch {
    return null
  }
}

type Porte = 'verification' | 'creation' | 'connexion' | 'injoignable'

export function EcranProf() {
  const [jeton, setJeton] = useState<string | null>(() => lireJetonMemorise())
  const [porte, setPorte] = useState<Porte>('verification')
  // Relance la question « le compte existe-t-il ? » après une panne.
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    if (jeton) return
    let vivant = true
    compteExiste()
      .then((existe) => {
        if (vivant) setPorte(existe ? 'connexion' : 'creation')
      })
      .catch(() => {
        if (vivant) setPorte('injoignable')
      })
    return () => {
      vivant = false
    }
  }, [jeton, essai])

  function ouvrir(nouveau: string) {
    try {
      sessionStorage.setItem(CLE_PROF, nouveau)
    } catch {
      // Sans mémoire, le mot de passe se retape au rechargement. Rien de plus.
    }
    setJeton(nouveau)
  }

  // Stable : le tableau de bord l'appelle quand son jeton est refusé, et il
  // fait partie des dépendances de l'effet qui le rafraîchit.
  const fermer = useCallback(() => {
    try {
      sessionStorage.removeItem(CLE_PROF)
    } catch {
      // La clé n'a jamais pu être écrite.
    }
    setPorte('verification')
    setJeton(null)
  }, [])

  if (jeton) {
    return <SessionProf jeton={jeton} onFermer={fermer} />
  }

  return (
    <main className="prof prof--porte">
      {porte === 'creation' && <Creation onOuvert={ouvrir} />}
      {porte === 'connexion' && <Connexion onOuvert={ouvrir} />}
      {porte === 'injoignable' && (
        <div className="prof__carte">
          <h1>Tableau de bord</h1>
          <p role="alert" className="prof__erreur">
            La plateforme ne répond pas. Vérifie que le serveur tourne, puis réessaie.
          </p>
          <button
            type="button"
            className="bouton bouton--sombre"
            onClick={() => {
              setPorte('verification')
              setEssai((n) => n + 1)
            }}
          >
            Réessayer
          </button>
        </div>
      )}
      {porte === 'verification' && (
        <div className="prof__carte" aria-busy="true">
          <h1>Tableau de bord</h1>
        </div>
      )}
    </main>
  )
}

/**
 * Premier lancement. Deux champs, parce qu'une faute de frappe ici ne se
 * rattrape qu'avec un accès au serveur.
 */
function Creation({ onOuvert }: { onOuvert: (jeton: string) => void }) {
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  // La confirmation n'est signalée fausse qu'une fois qu'elle ne peut plus
  // devenir juste : pendant la frappe, un début correct n'est pas une erreur.
  const differents = confirmation !== '' && !motDePasse.startsWith(confirmation)
  const pret = motDePasse.length >= LONGUEUR_MIN && confirmation === motDePasse && !enCours

  async function creer(evenement: FormEvent) {
    evenement.preventDefault()
    if (!pret) return
    setEnCours(true)
    try {
      onOuvert(await creerCompte(motDePasse))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Création impossible.')
      setEnCours(false)
    }
  }

  return (
    <form className="prof__carte" onSubmit={creer}>
      <h1>Créer le compte professeur</h1>
      <p className="prof__intro">
        Premier lancement : aucun compte professeur n'existe encore. Choisis le mot de passe qui
        ouvrira le tableau de bord — la progression de la classe, la liste des élèves et leurs
        codes d'accès.
      </p>
      <label htmlFor="mdp-nouveau">Mot de passe</label>
      <input
        id="mdp-nouveau"
        type="password"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        autoComplete="new-password"
        spellCheck={false}
        aria-describedby="mdp-regle"
      />
      <p id="mdp-regle" className="prof__regle">
        {LONGUEUR_MIN} caractères au minimum.
      </p>
      <label htmlFor="mdp-confirmation">Confirme le mot de passe</label>
      <input
        id="mdp-confirmation"
        type="password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        autoComplete="new-password"
        spellCheck={false}
        aria-describedby={differents ? 'mdp-differents' : undefined}
      />
      {differents && (
        <p id="mdp-differents" className="prof__regle prof__regle--faux">
          Les deux mots de passe diffèrent.
        </p>
      )}
      {erreur && (
        <p role="alert" className="prof__erreur">
          {erreur}
        </p>
      )}
      <button type="submit" className="bouton bouton--sombre" disabled={!pret}>
        Créer le compte
      </button>
      <p className="prof__aide">
        Il est rangé haché sur le serveur : personne ne pourra te le redonner. S'il se perd,{' '}
        <code className="mono">{COMMANDE_OUBLI}</code> efface le compte, et cet écran revient. Les
        élèves et leur progression restent.
      </p>
    </form>
  )
}

function Connexion({ onOuvert }: { onOuvert: (jeton: string) => void }) {
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function ouvrir(evenement: FormEvent) {
    evenement.preventDefault()
    if (!motDePasse || enCours) return
    setEnCours(true)
    try {
      onOuvert(await seConnecter(motDePasse))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.')
      setEnCours(false)
    }
  }

  return (
    <form className="prof__carte" onSubmit={ouvrir}>
      <h1>Tableau de bord</h1>
      <p className="prof__intro">
        Qui avance, qui bloque, et sur quoi. La page se rafraîchit toute seule toutes les dix
        secondes. C'est aussi ici que se crée la liste de la classe et que se distribuent les
        codes d'accès.
      </p>
      <label htmlFor="mdp-prof">Mot de passe</label>
      <input
        id="mdp-prof"
        type="password"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        autoComplete="current-password"
        spellCheck={false}
        aria-describedby={erreur ? 'erreur-prof' : undefined}
      />
      {erreur && (
        <p id="erreur-prof" role="alert" className="prof__erreur">
          {erreur}
        </p>
      )}
      <button type="submit" className="bouton bouton--sombre" disabled={!motDePasse || enCours}>
        Ouvrir
      </button>
      <p className="prof__aide">
        Mot de passe oublié ? Sur le serveur, <code className="mono">{COMMANDE_OUBLI}</code>{' '}
        efface le compte ; recharge ensuite cette page pour en créer un autre. Les élèves et leur
        progression restent.
      </p>
    </form>
  )
}

/**
 * Ce que le professeur voit une fois entré : la séance, sa classe, et l'aperçu
 * de l'espace élève quand il l'ouvre.
 */
function SessionProf({ jeton, onFermer }: { jeton: string; onFermer: () => void }) {
  // Un seul exécuteur pour tout l'aperçu, détruit en sortant : sans lui, les
  // exemples exécutables des leçons et le bouton « Valider » ne feraient rien.
  const executeur = useMemo(
    () => new Executeur(() => new Worker(new URL('../execution/worker.ts', import.meta.url))),
    [],
  )
  useEffect(() => () => executeur.detruire(), [executeur])

  // `null` : fermé. Une destination : ouvert là-dessus. `undefined` dans
  // l'objet signifie « ouvre où tu veux », c'est-à-dire la première leçon.
  const [apercu, setApercu] = useState<{ ou?: Destination } | null>(null)

  return (
    <main className="prof">
      <TableauDeBord
        jetonProf={jeton}
        onApercu={(ou) => setApercu({ ou })}
        onRefuse={onFermer}
      />

      <div className="prof__actions">
        <button type="button" className="bouton" onClick={() => setApercu({})}>
          Voir l'espace élève
        </button>
        <span className="prof__note">
          Le contenu réel, tel que la classe le lit. Rien n'y est enregistré.
        </span>
      </div>

      <Classe jetonProf={jeton} />

      <div className="prof__pied">
        <button type="button" className="bouton" onClick={onFermer}>
          Fermer la session professeur
        </button>
      </div>

      {/* Par-dessus, pas à la place : le tableau attend derrière, intact. */}
      {apercu && (
        <Apercu depart={apercu.ou} executeur={executeur} onFermer={() => setApercu(null)} />
      )}
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import { BROUILLON_VIDE, champsManquants, versExercice, type Brouillon } from '../atelier/brouillon'
import { eprouver, eprouverLecon, remplirAttendu, type Essai } from '../atelier/controles'
import {
  cataloguer,
  choisirDossier,
  ecrireFichier,
  lireFichier,
  peutOuvrirUnDossier,
  type EntreeDuDepot,
} from '../atelier/depot'
import { enregistrerEnPlace, peutEnregistrerEnPlace, telecharger } from '../atelier/fichiers'
import {
  champsManquantsLecon,
  LECON_VIDE,
  versLecon,
  type BrouillonLecon,
} from '../atelier/lecon'
import { FichierRefuse, lireExercice, lireLecon, porteDesCommentaires } from '../atelier/lecture'
import { chargerSchema, type SchemaPublie } from '../atelier/schema'
import { enYaml, leconEnYaml, nomDeFichier, nomDeFichierLecon } from '../atelier/yaml'
import { useContenuPublie } from '../prof/contenu'
import type { Executeur } from '../execution/executeur'
import { EcranExercice } from './EcranExercice'
import { PageCours } from './PageCours'
import { Depot, type Catalogue } from './atelier/Depot'
import { Essais } from './atelier/Essais'
import { Formulaire } from './atelier/Formulaire'
import { FormulaireLecon } from './atelier/FormulaireLecon'
import { Rail, type Ouvert } from './atelier/Rail'
import { Tests } from './atelier/Tests'
import './Atelier.css'

/**
 * L'atelier des exercices.
 *
 * Deux colonnes : à gauche ce qu'on remplit, à droite un panneau à deux
 * onglets — on ne regarde jamais l'aperçu et les essais en même temps, et ils
 * se disputeraient la place.
 *
 * Il ne parle à l'API pour rien : il lit le contenu publié, il éprouve dans le
 * navigateur, il rend un fichier — ou le réécrit à sa place quand il vient du
 * dossier du dépôt. Voir ADR-015.
 */
type Volet = 'apercu' | 'essais'

/** Ce qu'on est en train d'ecrire. Le rail bascule dessus tout seul. */
type Sorte = 'exercice' | 'lecon'

/** Un fichier lu, avant qu'il reçoive sa clé dans le rail. */
type Lu = Omit<Ouvert, 'cle'>

/**
 * Ce qu'un fichier devient une fois lu : un brouillon, ou un refus qui dit
 * pourquoi. `texte` vaut `null` quand le navigateur n'a pas su le lire du tout.
 *
 * Un refus ne fait pas disparaître le fichier : il reste dans le rail, marqué.
 * Le retirer en silence laisserait croire qu'on ne l'a jamais ouvert.
 */
function interpreter(nom: string, texte: string | null): Lu {
  // Un fichier de leçon porte un identifiant en `c…`, un exercice en `s…`. On
  // lit selon ce que le nom annonce, pour que le refus parle du bon schéma
  // plutôt que de reprocher à une leçon de ne pas être un exercice.
  const sorte = nom.startsWith('c') ? 'lecon' : 'exercice'
  if (texte === null) return { nom, sorte, brouillon: null, refus: 'fichier illisible.' }
  try {
    return {
      nom,
      sorte,
      brouillon: sorte === 'lecon' ? lireLecon(texte) : lireExercice(texte),
      commente: porteDesCommentaires(texte),
    }
  } catch (erreur) {
    return {
      nom,
      sorte,
      brouillon: null,
      refus: erreur instanceof FichierRefuse ? erreur.raisons.join(' ') : 'fichier illisible.',
    }
  }
}

export function Atelier({ executeur }: { executeur: Executeur }) {
  const contenu = useContenuPublie()
  const [schema, setSchema] = useState<SchemaPublie | null>(null)
  const [sorte, setSorte] = useState<Sorte>('exercice')
  const [brouillon, setBrouillon] = useState<Brouillon>(BROUILLON_VIDE)
  const [lecon, setLecon] = useState<BrouillonLecon>(LECON_VIDE)
  // Les fichiers ouverts, déposés ou repris du dépôt. Chacun garde ses
  // modifications : on passe de l'un à l'autre sans rien perdre.
  const [ouverts, setOuverts] = useState<Ouvert[]>([])
  // La CLÉ du fichier en cours d'édition, jamais son rang : voir `Ouvert.cle`.
  const [courant, setCourant] = useState<number | null>(null)
  const prochaineCle = useRef(0)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [lectureDuDossier, setLectureDuDossier] = useState(false)
  // Les chemins en cours de lecture : un double-clic lance deux lectures avant
  // que la première n'ait fini, et le fichier s'ouvrait deux fois.
  const enOuverture = useRef(new Set<string>())
  const [volet, setVolet] = useState<Volet>('apercu')
  const [essais, setEssais] = useState<Essai[] | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [alerte, setAlerte] = useState<string | null>(null)
  // Ce qu'une réécriture en place perdrait, tant que le professeur n'a pas dit
  // « quand même ».
  const [aConfirmer, setAConfirmer] = useState<string[] | null>(null)
  const [enregistre, setEnregistre] = useState<string | null>(null)

  const nonEnregistres = ouverts.some((o) => o.modifie)
  useEffect(() => {
    if (!nonEnregistres) return
    // Fermer l'onglet sur une correction pas encore écrite : le navigateur
    // demande confirmation. `returnValue` pour les navigateurs d'avant
    // `preventDefault`.
    function retenirLaFermeture(evenement: BeforeUnloadEvent) {
      evenement.preventDefault()
      evenement.returnValue = ''
    }
    window.addEventListener('beforeunload', retenirLaFermeture)
    return () => window.removeEventListener('beforeunload', retenirLaFermeture)
  }, [nonEnregistres])

  useEffect(() => {
    let vivant = true
    chargerSchema()
      .then((lu) => {
        if (vivant) setSchema(lu)
      })
      .catch(() => {
        if (vivant) setAlerte("Le schéma publié est introuvable : reconstruis le contenu.")
      })
    return () => {
      vivant = false
    }
  }, [])

  const manquants = sorte === 'exercice' ? champsManquants(brouillon) : champsManquantsLecon(lecon)

  /** Enregistre dans le fichier courant, et oublie les essais devenus faux. */
  function retenir(suivant: Brouillon | BrouillonLecon) {
    if (courant !== null) {
      setOuverts((liste) =>
        liste.map((o) => (o.cle === courant ? { ...o, brouillon: suivant, modifie: true } : o)),
      )
    }
    // Les essais valaient pour l'état d'avant : les garder affichés ferait
    // croire à un contenu éprouvé qu'on vient de modifier. Même chose pour
    // ce qu'on s'apprêtait à confirmer, et pour « enregistré ».
    setEssais(null)
    setAConfirmer(null)
    setEnregistre(null)
  }

  function changer(suivant: Brouillon) {
    setBrouillon(suivant)
    retenir(suivant)
  }

  function changerLecon(suivant: BrouillonLecon) {
    setLecon(suivant)
    retenir(suivant)
  }

  function numeroter(lu: Lu): Ouvert {
    return { ...lu, cle: prochaineCle.current++ }
  }

  async function deposer(fichiers: File[]) {
    setAlerte(null)
    const lus: Ouvert[] = []
    for (const fichier of fichiers) {
      // Un fichier que le navigateur ne sait pas lire devient un refus : il
      // faisait sinon échouer tout le lâcher, et les fichiers sains déposés
      // avec lui étaient perdus.
      const texte = await fichier.text().catch(() => null)
      lus.push(numeroter(interpreter(fichier.name, texte)))
    }
    setOuverts((liste) => [...liste, ...lus])
    // On ouvre le premier qui a été accepté, s'il y en a un.
    const premier = lus.find((o) => o.brouillon !== null)
    if (premier) choisir(premier)
  }

  async function ouvrirDossier() {
    setAlerte(null)
    setLectureDuDossier(true)
    try {
      const dossier = await choisirDossier()
      // Fenêtre fermée : le professeur a changé d'avis, le catalogue d'avant
      // reste.
      if (dossier) setCatalogue({ nom: dossier.name, entrees: await cataloguer(dossier) })
    } catch {
      setAlerte(
        "Le dossier n'a pas pu être ouvert. Réessaie, et autorise la modification des fichiers : " +
          "c'est elle qui permet d'enregistrer une correction à sa place.",
      )
    } finally {
      setLectureDuDossier(false)
    }
  }

  /** Le fichier tel que l'atelier l'écrit. */
  function enTexte(sorteDuFichier: Sorte, contenuDuFichier: unknown): string {
    if (sorteDuFichier === 'exercice') return enYaml(contenuDuFichier as Brouillon)
    // L'ordre d'une leçon est celui de sa notion : le schéma refuse le
    // désaccord, et l'atelier ne peut donc pas le laisser choisir.
    const l = contenuDuFichier as BrouillonLecon
    return leconEnYaml(l, contenu?.notions.find((n) => n.id === l.notion)?.ordre ?? 1)
  }

  /** Reprend un fichier du dépôt : relu à l'instant, et ouvert dans le rail. */
  async function reprendre(entree: EntreeDuDepot) {
    setAlerte(null)
    const deja = ouverts.find((o) => o.depot?.chemin === entree.chemin)
    // Déjà ouvert : on y retourne SANS relire, ce qui écraserait ce qu'on y a
    // changé. Un fichier refusé, lui, se relit — on vient peut-être de le
    // réparer dans l'éditeur.
    if (deja && deja.brouillon !== null) {
      choisir(deja)
      return
    }
    if (enOuverture.current.has(entree.chemin)) return
    enOuverture.current.add(entree.chemin)
    try {
      // Relu ici plutôt que pris au catalogue : le fichier a pu changer sur
      // le disque depuis que le dossier a été ouvert.
      const texte = await lireFichier(entree.poignee).catch(() => null)
      const lu = interpreter(entree.nom, texte)
      const repris = numeroter({
        ...lu,
        depot: {
          chemin: entree.chemin,
          poignee: entree.poignee,
          lu: texte ?? '',
          // Un tiers des exercices et presque toutes les leçons du chapitre 1
          // ont été écrits à la main dans une mise en page que l'atelier ne
          // reproduit pas. Le dire avant qu'un diff de trente lignes ne
          // surprenne, pour une virgule corrigée.
          horsStyle: texte !== null && lu.brouillon !== null && enTexte(lu.sorte, lu.brouillon) !== texte,
        },
      })
      setOuverts((liste) => [...liste.filter((o) => o.cle !== deja?.cle), repris])
      if (repris.brouillon !== null) choisir(repris)
    } finally {
      enOuverture.current.delete(entree.chemin)
    }
  }

  /** Ouvre un fichier du rail, et bascule sur sa sorte. */
  function choisir(ouvert: Ouvert) {
    setCourant(ouvert.cle)
    setSorte(ouvert.sorte)
    if (ouvert.sorte === 'lecon') setLecon(ouvert.brouillon as BrouillonLecon)
    else setBrouillon(ouvert.brouillon as Brouillon)
    setEssais(null)
    setAConfirmer(null)
    setEnregistre(null)
  }

  async function lancer() {
    setEnCours(true)
    setAlerte(null)
    try {
      if (sorte === 'lecon') {
        setEssais(await eprouverLecon(lecon, executeur))
      } else {
        // `contenu` est forcément là : la page rend un écran d'attente tant
        // qu'il manque, et ce bouton n'existe pas avant. Le `??` est une
        // garde que TypeScript exige, pas un cas qui se produit.
        /* v8 ignore next */
        setEssais(await eprouver(brouillon, contenu?.notions ?? [], executeur))
      }
    } finally {
      setEnCours(false)
    }
  }

  async function remplir(index: number) {
    setAlerte(null)
    try {
      const attendu = await remplirAttendu(brouillon, index, executeur)
      changer({
        ...brouillon,
        tests: brouillon.tests.map((t, i) =>
          i === index && t.type === 'sortie' ? { ...t, attendu } : t,
        ),
      })
    } catch (erreur) {
      setAlerte(erreur instanceof Error ? erreur.message : 'Remplissage impossible.')
    }
  }

  // Le fichier courant, et l'endroit où il se réécrit s'il vient du dépôt.
  // Un identifiant changé en cours de route n'y retourne PAS : `s3-07.yaml`
  // qui contiendrait `s3-09` serait un exercice sous le nom d'un autre, et
  // la construction ne compare pas les deux. Il part comme un fichier neuf,
  // et l'original reste tel quel.
  const ouvert = ouverts.find((o) => o.cle === courant)
  const nom = sorte === 'lecon' ? nomDeFichierLecon(lecon) : nomDeFichier(brouillon)
  const aSaPlace = ouvert?.depot && ouvert.nom === nom ? ouvert.depot : null

  /** Le fichier courant n'a plus rien de neuf à écrire. */
  function oublierModifie(cle: number, ecrit: Ouvert['brouillon']) {
    setOuverts((liste) =>
      // Changé pendant l'écriture : le disque n'a déjà plus ce qu'on voit.
      liste.map((o) => (o.cle === cle ? { ...o, modifie: o.brouillon !== ecrit } : o)),
    )
  }

  async function sortir(confirme: boolean) {
    setAlerte(null)
    setEnregistre(null)
    const texte = enTexte(sorte, sorte === 'lecon' ? lecon : brouillon)
    if (ouvert && aSaPlace) {
      await reecrire(ouvert, aSaPlace, texte, confirme)
      return
    }
    // Un fichier du dépôt parti sous un autre nom reste « modifié » : le
    // sien, sur le disque, n'a pas bougé.
    const oublier = () => {
      if (ouvert && !ouvert.depot) oublierModifie(ouvert.cle, ouvert.brouillon)
    }
    if (!peutEnregistrerEnPlace()) {
      telecharger(nom, texte)
      oublier()
      return
    }
    try {
      if ((await enregistrerEnPlace(nom, texte)) === 'enregistre') oublier()
    } catch {
      // L'enregistrement en place a échoué pour autre chose qu'un abandon :
      // le téléchargement reste, et le professeur ne perd pas son travail.
      telecharger(nom, texte)
      oublier()
    }
  }

  /**
   * Réécrit un fichier du dépôt à sa place.
   *
   * Deux choses ne se perdent pas sans que le professeur l'ait dit : les
   * commentaires du fichier, que l'atelier ne sait pas rendre, et ce qui a
   * changé sur le disque depuis la lecture — une correction faite entre-temps
   * dans l'éditeur, par exemple.
   */
  async function reecrire(
    cible: Ouvert,
    depot: NonNullable<Ouvert['depot']>,
    texte: string,
    confirme: boolean,
  ) {
    let surLeDisque: string
    try {
      surLeDisque = await lireFichier(depot.poignee)
    } catch {
      setAlerte(
        `${depot.chemin} est introuvable : a-t-il été déplacé ou renommé ? Rouvre le dossier du dépôt.`,
      )
      return
    }
    if (!confirme) {
      const risques: string[] = []
      if (porteDesCommentaires(surLeDisque)) {
        risques.push("Ce fichier porte des commentaires : l'enregistrer les efface.")
      }
      if (surLeDisque !== depot.lu) {
        risques.push(
          "Il a changé sur le disque depuis que tu l'as ouvert : l'enregistrer écrase ces changements.",
        )
      }
      if (risques.length > 0) {
        setAConfirmer(risques)
        return
      }
    }
    try {
      await ecrireFichier(depot.poignee, texte)
    } catch {
      setAlerte(
        `L'enregistrement de ${depot.chemin} a échoué. Rien n'est perdu : la correction reste ouverte, réessaie.`,
      )
      return
    }
    setOuverts((liste) =>
      liste.map((o) =>
        o.cle === cible.cle
          ? { ...o, commente: false, depot: { ...depot, lu: texte, horsStyle: false } }
          : o,
      ),
    )
    oublierModifie(cible.cle, cible.brouillon)
    setAConfirmer(null)
    setEnregistre(`Enregistré dans ${depot.chemin}.`)
  }

  if (!schema || !contenu) {
    return (
      <div className="atelier atelier--attente">
        {alerte ? <p role="alert">{alerte}</p> : <p>Chargement du schéma…</p>}
      </div>
    )
  }

  return (
    <div className="atelier">
      <div className="atelier__colonne">
        <Depot
          possible={peutOuvrirUnDossier()}
          catalogue={catalogue}
          enCours={lectureDuDossier}
          onOuvrirDossier={ouvrirDossier}
          onReprendre={reprendre}
        />

        <Rail
          ouverts={ouverts}
          courant={courant}
          onChoisir={(cle) => choisir(ouverts.find((o) => o.cle === cle)!)}
          onDeposer={deposer}
          onFermer={(cle) => {
            setOuverts((liste) => liste.filter((o) => o.cle !== cle))
            if (cle === courant) setCourant(null)
          }}
        />

        <fieldset className="atelier__sorte">
          <legend>Ce que j'écris</legend>
          {(
            [
              ['exercice', 'Un exercice'],
              ['lecon', 'Une leçon'],
            ] as [Sorte, string][]
          ).map(([id, libelle]) => (
            <label key={id} className="champ champ--case">
              <input
                type="radio"
                name="sorte"
                checked={sorte === id}
                onChange={() => {
                  setSorte(id)
                  // On quitte le fichier ouvert : il est d'une autre sorte,
                  // et le garder courant enregistrerait un exercice dans une
                  // leçon.
                  setCourant(null)
                  setEssais(null)
                }}
              />
              <span>{libelle}</span>
            </label>
          ))}
        </fieldset>

        {sorte === 'exercice' ? (
          <>
            <Formulaire
              brouillon={brouillon}
              notions={contenu.notions}
              schema={schema}
              onChange={changer}
            />
            <Tests
              tests={brouillon.tests}
              onChange={(tests) => changer({ ...brouillon, tests })}
              onRemplir={remplir}
            />
          </>
        ) : (
          <FormulaireLecon brouillon={lecon} notions={contenu.notions} onChange={changerLecon} />
        )}

        <div className="atelier__sortie">
          <button
            type="button"
            className="bouton bouton--sombre"
            // Jamais `onClick={sortir}` : l'événement arriverait en premier
            // argument, vaudrait « confirmé », et sauterait la confirmation.
            onClick={() => void sortir(false)}
            disabled={manquants.length > 0}
          >
            {aSaPlace
              ? 'Enregistrer dans le dépôt'
              : peutEnregistrerEnPlace()
                ? 'Enregistrer le fichier'
                : 'Télécharger le fichier'}
          </button>
          {manquants.length > 0 ? (
            <p className="atelier__note">À compléter d'abord : {manquants.join(', ')}.</p>
          ) : aSaPlace ? (
            <p className="atelier__note">
              Réécrit <code className="mono">{aSaPlace.chemin}</code>, à sa place.
              {aSaPlace.horsStyle &&
                " Il n'est pas écrit dans la mise en page de l'atelier : elle changera, pas son" +
                  ' sens — le diff dépassera ta correction.'}
            </p>
          ) : (
            ouvert?.depot && (
              <p className="atelier__note">
                L'identifiant a changé : ce sera un nouveau fichier,{' '}
                <code className="mono">{nom}</code>. <code className="mono">{ouvert.nom}</code>{' '}
                reste tel quel.
              </p>
            )
          )}
        </div>

        {aConfirmer && (
          <div className="atelier__confirmation">
            <div role="alert">
              {aConfirmer.map((risque) => (
                <p key={risque}>{risque}</p>
              ))}
            </div>
            <div className="atelier__confirmation-actions">
              <button
                type="button"
                className="bouton bouton--sombre"
                onClick={() => void sortir(true)}
              >
                Enregistrer quand même
              </button>
              <button type="button" className="bouton" onClick={() => setAConfirmer(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {enregistre && (
          <p role="status" className="atelier__enregistre">
            {enregistre}
          </p>
        )}

        {alerte && (
          <p role="alert" className="atelier__alerte">
            {alerte}
          </p>
        )}
      </div>

      <div className="atelier__colonne atelier__colonne--droite">
        {/* Une TROISIÈME tablist sur la page quand l'atelier est ouvert :
            celle de l'espace professeur, celle de « Ma classe », et celle-ci.
            Sans trois noms distincts, un lecteur d'écran les confond. */}
        <nav className="atelier__volets" role="tablist" aria-label="Aperçu et essais">
          {(
            [
              ['apercu', "Aperçu"],
              ['essais', 'Essais'],
            ] as [Volet, string][]
          ).map(([id, libelle]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={volet === id}
              className="atelier__volet"
              onClick={() => setVolet(id)}
            >
              {libelle}
            </button>
          ))}
        </nav>

        {volet === 'apercu' && (
          <div className="atelier__apercu">
            {sorte === 'exercice' ? (
              <EcranExercice
                key={brouillon.id}
                exercice={versExercice(brouillon, contenu.notions)}
                executeur={executeur}
                onTentative={() => undefined}
              />
            ) : (
              // `PageCours` attend un groupe de notion, pas une leçon seule :
              // c'est ainsi que l'élève la reçoit. Les exercices sont vides,
              // la progression aussi — rien n'est enregistré dans l'aperçu.
              <PageCours
                key={lecon.id}
                groupe={{
                  ...(contenu.notions.find((n) => n.id === lecon.notion) ?? {
                    id: '',
                    ordre: 1,
                    titre: '',
                    famille: 'variables' as const,
                    chapitre: '',
                  }),
                  lecon: versLecon(lecon, contenu.notions),
                  exercices: [],
                  faits: 0,
                  total: 0,
                }}
                executeur={executeur}
              />
            )}
          </div>
        )}

        {volet === 'essais' && (
          <Essais essais={essais} enCours={enCours} manquants={manquants} onLancer={lancer} />
        )}
      </div>
    </div>
  )
}

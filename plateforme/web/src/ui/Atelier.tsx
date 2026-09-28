import { useEffect, useState } from 'react'
import { BROUILLON_VIDE, champsManquants, versExercice, type Brouillon } from '../atelier/brouillon'
import { eprouver, remplirAttendu, type Essai } from '../atelier/controles'
import { enregistrerEnPlace, peutEnregistrerEnPlace, telecharger } from '../atelier/fichiers'
import { FichierRefuse, lireExercice, porteDesCommentaires } from '../atelier/lecture'
import { chargerSchema, type SchemaPublie } from '../atelier/schema'
import { enYaml, nomDeFichier } from '../atelier/yaml'
import { useContenuPublie } from '../prof/contenu'
import type { Executeur } from '../execution/executeur'
import { EcranExercice } from './EcranExercice'
import { Essais } from './atelier/Essais'
import { Formulaire } from './atelier/Formulaire'
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
 * navigateur, il rend un fichier. Voir ADR-015.
 */
type Volet = 'apercu' | 'essais'

export function Atelier({ executeur }: { executeur: Executeur }) {
  const contenu = useContenuPublie()
  const [schema, setSchema] = useState<SchemaPublie | null>(null)
  const [brouillon, setBrouillon] = useState<Brouillon>(BROUILLON_VIDE)
  // Les fichiers déposés. Chacun garde ses modifications : on passe de l'un à
  // l'autre sans rien perdre.
  const [ouverts, setOuverts] = useState<Ouvert[]>([])
  const [courant, setCourant] = useState<number | null>(null)
  const [volet, setVolet] = useState<Volet>('apercu')
  const [essais, setEssais] = useState<Essai[] | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [alerte, setAlerte] = useState<string | null>(null)

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

  const manquants = champsManquants(brouillon)

  function changer(suivant: Brouillon) {
    setBrouillon(suivant)
    if (courant !== null) {
      setOuverts((liste) =>
        liste.map((o, rang) => (rang === courant ? { ...o, brouillon: suivant } : o)),
      )
    }
    // Les essais valaient pour l'état d'avant : les garder affichés
    // ferait croire à un exercice éprouvé qu'on vient de modifier.
    setEssais(null)
  }

  async function deposer(fichiers: File[]) {
    setAlerte(null)
    const lus: Ouvert[] = []
    for (const fichier of fichiers) {
      try {
        // La lecture EST dans le try : un fichier que le navigateur ne sait
        // pas lire faisait sinon échouer tout le lâcher, et les fichiers
        // sains déposés avec lui étaient perdus.
        const texte = await fichier.text()
        lus.push({
          nom: fichier.name,
          brouillon: lireExercice(texte),
          commente: porteDesCommentaires(texte),
        })
      } catch (erreur) {
        // Le fichier reste dans le rail, marqué : le retirer en silence
        // laisserait croire qu'on ne l'a jamais lâché.
        lus.push({
          nom: fichier.name,
          brouillon: null,
          refus:
            erreur instanceof FichierRefuse ? erreur.raisons.join(' ') : 'fichier illisible.',
        })
      }
    }
    const debut = ouverts.length
    setOuverts([...ouverts, ...lus])
    // On ouvre le premier qui a été accepté, s'il y en a un.
    const premier = lus.findIndex((o) => o.brouillon !== null)
    if (premier !== -1) choisir(debut + premier, lus[premier]!.brouillon as Brouillon)
  }

  function choisir(rang: number, quoi: Brouillon) {
    setCourant(rang)
    setBrouillon(quoi)
    setEssais(null)
  }

  async function lancer() {
    setEnCours(true)
    setAlerte(null)
    try {
      // `contenu` est forcément là : la page rend un écran d'attente tant
      // qu'il manque, et ce bouton n'existe pas avant. Le `??` est une garde
      // que TypeScript exige, pas un cas qui se produit.
      /* v8 ignore next */
      setEssais(await eprouver(brouillon, contenu?.notions ?? [], executeur))
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

  async function sortir() {
    setAlerte(null)
    const texte = enYaml(brouillon)
    const nom = nomDeFichier(brouillon)
    if (!peutEnregistrerEnPlace()) {
      telecharger(nom, texte)
      return
    }
    try {
      await enregistrerEnPlace(nom, texte)
    } catch {
      // L'enregistrement en place a échoué pour autre chose qu'un abandon :
      // le téléchargement reste, et le professeur ne perd pas son travail.
      telecharger(nom, texte)
    }
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
        <Rail
          ouverts={ouverts}
          courant={courant}
          onChoisir={(rang) => choisir(rang, ouverts[rang]!.brouillon as Brouillon)}
          onDeposer={deposer}
          onFermer={(rang) => {
            setOuverts((liste) => liste.filter((_, i) => i !== rang))
            if (rang === courant) setCourant(null)
          }}
        />

        <Formulaire
          brouillon={brouillon}
          notions={contenu.notions}
          schema={schema}
          onChange={changer}
        />
        <Tests tests={brouillon.tests} onChange={(tests) => changer({ ...brouillon, tests })} onRemplir={remplir} />

        <div className="atelier__sortie">
          <button
            type="button"
            className="bouton bouton--sombre"
            onClick={sortir}
            disabled={manquants.length > 0}
          >
            {peutEnregistrerEnPlace() ? 'Enregistrer le fichier' : 'Télécharger le fichier'}
          </button>
          {manquants.length > 0 && (
            <p className="atelier__note">À compléter d'abord : {manquants.join(', ')}.</p>
          )}
        </div>

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
            <EcranExercice
              key={brouillon.id}
              exercice={versExercice(brouillon, contenu.notions)}
              executeur={executeur}
              onTentative={() => undefined}
            />
          </div>
        )}

        {volet === 'essais' && (
          <Essais essais={essais} enCours={enCours} manquants={manquants} onLancer={lancer} />
        )}
      </div>
    </div>
  )
}

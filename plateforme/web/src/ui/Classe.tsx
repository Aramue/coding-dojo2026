import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  creerEleve,
  decouperListe,
  listerEleves,
  modifierEleve,
  retirerEleve,
  FICHE_VIDE,
  type EleveInscrit,
  type Fiche,
} from '../prof/classe'
import './Classe.css'

/**
 * La liste de la classe : créer, corriger, retirer.
 *
 * C'est ici que naissent les codes d'accès. Ils ne sont plus distribués à
 * l'avance ni devinés : le professeur inscrit ses élèves, la plateforme tire
 * un code par élève, et lui le recopie au tableau ou sur un papier.
 */
export function Classe({ codeProf }: { codeProf: string }) {
  const [eleves, setEleves] = useState<EleveInscrit[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [charge, setCharge] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [enEdition, setEnEdition] = useState<string | null>(null)

  const rafraichir = useCallback(async () => {
    try {
      setEleves(await listerEleves(codeProf))
      setErreur(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Liste indisponible.')
    } finally {
      setCharge(true)
    }
  }, [codeProf])

  useEffect(() => {
    void rafraichir()
  }, [rafraichir])

  /** Enchaîne une action d'écriture et la relecture, sans double clic possible. */
  async function agir(action: () => Promise<unknown>) {
    setEnCours(true)
    try {
      await action()
      setErreur(null)
      await rafraichir()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section className="classe" aria-labelledby="titre-classe">
      <header className="classe__entete">
        <h2 id="titre-classe">Ma classe</h2>
        <p className="classe__effectif">
          {eleves.length} {eleves.length <= 1 ? 'élève inscrit' : 'élèves inscrits'}
        </p>
      </header>

      {erreur && <p role="alert">{erreur}</p>}

      <Ajout enCours={enCours} onAjouter={(fiches) => agir(() => ajouterToutes(codeProf, fiches))} />

      {charge && eleves.length === 0 && !erreur && (
        <p className="classe__vide">
          Aucun élève pour l'instant. Ajoute-les ci-dessus : la plateforme donne un code à chacun.
        </p>
      )}

      {eleves.length > 0 && (
        <ul className="classe__liste">
          {eleves.map((eleve) =>
            enEdition === eleve.code_acces ? (
              <li key={eleve.code_acces} className="inscrit inscrit--edition">
                <Formulaire
                  depart={eleve}
                  enCours={enCours}
                  legende={`Modifier ${eleve.prenom} ${eleve.nom}`.trim()}
                  libelleAction="Enregistrer"
                  onValider={async (fiche) => {
                    await agir(() => modifierEleve(codeProf, eleve.code_acces, fiche))
                    setEnEdition(null)
                  }}
                  onAnnuler={() => setEnEdition(null)}
                />
              </li>
            ) : (
              <li key={eleve.code_acces} className="inscrit">
                <span className="inscrit__code mono">{eleve.code_acces}</span>
                <span className="inscrit__identite">
                  <b>
                    {eleve.prenom} {eleve.nom}
                  </b>
                  {eleve.etablissement && (
                    <span className="inscrit__etablissement">{eleve.etablissement}</span>
                  )}
                </span>
                <span className="inscrit__tentatives">
                  {eleve.tentatives === 0
                    ? 'pas encore connecté'
                    : `${eleve.tentatives} tentative${eleve.tentatives > 1 ? 's' : ''}`}
                </span>
                <span className="inscrit__actions">
                  <button
                    type="button"
                    className="bouton bouton--menu"
                    onClick={() => setEnEdition(eleve.code_acces)}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="bouton bouton--menu bouton--danger"
                    disabled={enCours}
                    onClick={() => {
                      // La suppression emporte les tentatives : on nomme
                      // l'élève ET ce qu'on efface, jamais un « Confirmer ? » nu.
                      const perdu =
                        eleve.tentatives > 0
                          ? ` et ses ${eleve.tentatives} tentatives`
                          : ''
                      const sur = confirm(
                        `Retirer ${eleve.prenom} ${eleve.nom}${perdu} ? C'est définitif.`,
                      )
                      if (sur) void agir(() => retirerEleve(codeProf, eleve.code_acces))
                    }}
                  >
                    Retirer
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}

/** Les créations partent l'une après l'autre : le serveur tire un code par appel. */
async function ajouterToutes(codeProf: string, fiches: Fiche[]): Promise<void> {
  for (const fiche of fiches) await creerEleve(codeProf, fiche)
}

function Ajout({
  enCours,
  onAjouter,
}: {
  enCours: boolean
  onAjouter: (fiches: Fiche[]) => Promise<void>
}) {
  const [enLot, setEnLot] = useState(false)

  return (
    <div className="ajout">
      <div className="ajout__onglets" role="tablist" aria-label="Façon d'ajouter">
        <button
          type="button"
          role="tab"
          aria-selected={!enLot}
          className="ajout__onglet"
          onClick={() => setEnLot(false)}
        >
          Un élève
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={enLot}
          className="ajout__onglet"
          onClick={() => setEnLot(true)}
        >
          Coller une liste
        </button>
      </div>

      {enLot ? (
        <Lot enCours={enCours} onAjouter={onAjouter} />
      ) : (
        <Formulaire
          depart={FICHE_VIDE}
          enCours={enCours}
          libelleAction="Ajouter"
          viderApres
          onValider={(fiche) => onAjouter([fiche])}
        />
      )}
    </div>
  )
}

function Formulaire({
  depart,
  enCours,
  legende,
  libelleAction,
  viderApres = false,
  onValider,
  onAnnuler,
}: {
  depart: Fiche
  enCours: boolean
  /** Nomme le formulaire quand deux coexistent — l'ajout et une modification. */
  legende?: string
  libelleAction: string
  viderApres?: boolean
  onValider: (fiche: Fiche) => Promise<void>
  onAnnuler?: () => void
}) {
  const [fiche, setFiche] = useState<Fiche>({
    prenom: depart.prenom,
    nom: depart.nom,
    etablissement: depart.etablissement,
  })

  async function envoyer(evenement: FormEvent) {
    evenement.preventDefault()
    if (!fiche.prenom.trim()) return
    await onValider(fiche)
    if (viderApres) setFiche(FICHE_VIDE)
  }

  const champ = (cle: keyof Fiche, libelle: string, requis = false) => (
    <label className="champ">
      <span>
        {libelle}
        {requis && <b aria-hidden="true"> *</b>}
      </span>
      <input
        value={fiche[cle]}
        required={requis}
        onChange={(e) => setFiche((f) => ({ ...f, [cle]: e.target.value }))}
        autoComplete="off"
      />
    </label>
  )

  return (
    <form className="fiche" onSubmit={envoyer} aria-label={legende}>
      {legende && <p className="fiche__legende">{legende}</p>}
      {champ('prenom', 'Prénom', true)}
      {champ('nom', 'Nom')}
      {champ('etablissement', 'Établissement')}
      <div className="fiche__actions">
        <button
          type="submit"
          className="bouton bouton--sombre"
          disabled={enCours || !fiche.prenom.trim()}
        >
          {libelleAction}
        </button>
        {onAnnuler && (
          <button type="button" className="bouton" onClick={onAnnuler}>
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}

/**
 * Coller la feuille d'appel plutôt que de la retaper.
 *
 * L'aperçu compte les élèves reconnus avant d'écrire quoi que ce soit : sur
 * vingt-quatre lignes, une colonne mal devinée doit se voir avant, pas après.
 */
function Lot({
  enCours,
  onAjouter,
}: {
  enCours: boolean
  onAjouter: (fiches: Fiche[]) => Promise<void>
}) {
  const [texte, setTexte] = useState('')
  const fiches = decouperListe(texte)

  return (
    <form
      className="lot"
      onSubmit={async (evenement) => {
        evenement.preventDefault()
        if (fiches.length === 0) return
        await onAjouter(fiches)
        setTexte('')
      }}
    >
      <label className="champ">
        <span>Une ligne par élève : prénom, nom, établissement</span>
        <textarea
          value={texte}
          rows={5}
          spellCheck={false}
          placeholder={'Enzo\tPoupard\tCalvin\nIziz\tGaston\tRousseau'}
          onChange={(e) => setTexte(e.target.value)}
        />
      </label>
      <div className="lot__pied">
        <span className="lot__apercu">
          {fiches.length === 0
            ? 'Tabulation, point-virgule ou virgule entre les colonnes.'
            : `${fiches.length} élève${fiches.length > 1 ? 's' : ''} reconnu${
                fiches.length > 1 ? 's' : ''
              } : ${fiches
                .slice(0, 3)
                .map((f) => f.prenom)
                .join(', ')}${fiches.length > 3 ? '…' : ''}`}
        </span>
        <button
          type="submit"
          className="bouton bouton--sombre"
          disabled={enCours || fiches.length === 0}
        >
          {enCours ? 'Création…' : `Créer ${fiches.length || ''}`.trim()}
        </button>
      </div>
    </form>
  )
}

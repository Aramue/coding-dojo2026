import { useMemo, useState, type MouseEvent } from 'react'
import { grouper, grouperParChapitre } from '../contenu/notions'
import type { Executeur } from '../execution/executeur'
import { useContenuPublie } from '../prof/contenu'
import { analyser, type Destination } from '../routage'
import { EcranExercice } from './EcranExercice'
import { Menu } from './Menu'
import { PageCours } from './PageCours'
import { PageExercices } from './PageExercices'
import './Apercu.css'

/**
 * L'espace élève, vu par le professeur.
 *
 * Ce ne sont pas des copies d'écran ni une maquette : ==ce sont les composants
 * de l'élève, avec le contenu publié==, montés tels quels. Ce que le professeur
 * lit ici est exactement ce que la classe lira, y compris les fautes de frappe
 * d'un énoncé et la longueur réelle d'une leçon. C'est ce qui permet de cadrer
 * une séance avant de la faire.
 *
 * Rien n'est enregistré : la progression affichée est vide, et une validation
 * ne part nulle part.
 */
export function Apercu({
  depart,
  executeur,
  onFermer,
}: {
  /** Où ouvrir l'aperçu — l'exercice qu'on veut lire, ou la première leçon. */
  depart?: Destination
  executeur: Executeur
  onFermer: () => void
}) {
  const contenu = useContenuPublie()
  const [ou, setOu] = useState<Destination | null>(depart ?? null)

  const groupes = useMemo(
    () =>
      contenu ? grouper(contenu.notions, contenu.exercices, contenu.lecons, []) : [],
    [contenu],
  )
  const chapitres = useMemo(
    () => (contenu ? grouperParChapitre(contenu.chapitres, groupes) : []),
    [contenu, groupes],
  )

  // Faute de point de départ, on ouvre sur la première leçon : c'est par là que
  // l'élève commence, donc par là qu'on cadre.
  const destination: Destination =
    ou ?? (groupes[0] ? { vue: 'cours', notion: groupes[0].id } : { vue: 'inconnue' })

  /**
   * Les composants élève naviguent par `naviguer()`, qui change l'URL réelle.
   * On intercepte le clic AVANT eux : la destination se lit dans le `href`, et
   * pilote l'état local. ==Sans cela, un clic dans l'aperçu ferait quitter le
   * tableau de bord au professeur==, sans qu'il comprenne pourquoi.
   */
  function intercepter(evenement: MouseEvent<HTMLDivElement>) {
    const lien = (evenement.target as HTMLElement).closest?.('a[href]')
    if (!(lien instanceof HTMLAnchorElement)) return
    evenement.preventDefault()
    evenement.stopPropagation()
    setOu(analyser(new URL(lien.href, location.origin).pathname))
  }

  return (
    <section className="apercu" aria-label="Aperçu de l'espace élève">
      <header className="apercu__barre">
        <div>
          <b>Aperçu de l'espace élève</b>
          <span className="apercu__note">
            Le contenu réel, avec une progression vide. Rien n'est enregistré ici.
          </span>
        </div>
        <button type="button" className="bouton" onClick={onFermer}>
          Fermer l'aperçu
        </button>
      </header>

      {!contenu ? (
        <p className="apercu__vide">Chargement du contenu…</p>
      ) : (
        <div className="apercu__cadre" onClickCapture={intercepter}>
          <div className="appli appli--apercu">
            <Menu chapitres={chapitres} destination={destination} />
            <Vue destination={destination} groupes={groupes} executeur={executeur} />
          </div>
        </div>
      )}
    </section>
  )
}

/** Le même aiguillage que côté élève, sans le client d'API ni la progression. */
function Vue({
  destination,
  groupes,
  executeur,
}: {
  destination: Destination
  groupes: ReturnType<typeof grouper>
  executeur: Executeur
}) {
  const groupe =
    'notion' in destination ? groupes.find((g) => g.id === destination.notion) : undefined
  if (!groupe) return <p className="apercu__vide">Cette page n'existe pas.</p>

  if (destination.vue === 'cours') return <PageCours groupe={groupe} executeur={executeur} />

  if (destination.vue === 'exercices') {
    const rang = groupes.indexOf(groupe)
    return <PageExercices groupe={groupe} reussis={[]} suivante={groupes[rang + 1]} />
  }

  if (destination.vue === 'exercice') {
    const exercice = groupe.exercices[destination.numero - 1]
    if (!exercice) return <p className="apercu__vide">Cet exercice n'existe pas.</p>

    const avant = groupe.exercices[destination.numero - 2]
    const apres = groupe.exercices[destination.numero]
    return (
      <EcranExercice
        key={exercice.id}
        titreNotion={groupe.titre}
        exercice={exercice}
        executeur={executeur}
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
        // Rien n'est enregistré : le professeur peut résoudre l'exercice pour
        // le vérifier sans qu'aucune tentative n'atterrisse dans la séance.
        onTentative={() => undefined}
      />
    )
  }

  return <p className="apercu__vide">Cette page n'existe pas.</p>
}

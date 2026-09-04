import { useEffect, useState } from 'react'
import { partLue, useDefilement } from './defilement'
import './ProgressionLecture.css'

/**
 * Barre de progression de lecture, collée sous l'en-tête.
 *
 * Elle répond à la question qu'on se pose en arrivant sur un texte : combien
 * il en reste. Sur une leçon de trois minutes, c'est ce qui empêche de la
 * refermer en croyant qu'elle est longue.
 *
 * > [!danger] Elle ne suppose pas que c'est la fenêtre qui défile
 * > Dans l'aperçu du professeur, la page est figée et c'est le cadre qui
 * > défile. En lisant `scrollY`, la barre mesurait ==un défilement qui n'a pas
 * > lieu== : elle se croyait lue en entier et s'affichait pleine, plantée au
 * > milieu du contenu. `ContexteDefilement` dit qui bouge réellement.
 *
 * La mesure passe par `requestAnimationFrame` : l'événement de défilement part
 * à chaque pixel, et recalculer la mise en page à cette cadence fait saccader
 * la page sur les machines des salles.
 */
export function ProgressionLecture() {
  const conteneur = useDefilement()
  const [part, setPart] = useState(0)

  useEffect(() => {
    let demande = 0
    // La fenêtre pour l'élève, le cadre pour le professeur : l'écouteur se
    // pose sur celui qui bouge.
    const source: HTMLElement | Window = conteneur ?? window

    function mesurer() {
      setPart(partLue(conteneur))
      demande = 0
    }

    function auDefilement() {
      if (demande === 0) demande = requestAnimationFrame(mesurer)
    }

    mesurer()
    source.addEventListener('scroll', auDefilement, { passive: true })
    addEventListener('resize', auDefilement)
    return () => {
      cancelAnimationFrame(demande)
      source.removeEventListener('scroll', auDefilement)
      removeEventListener('resize', auDefilement)
    }
  }, [conteneur])

  return (
    <div className="lecture" aria-hidden="true">
      <span className="lecture__part" style={{ transform: `scaleX(${part})` }} />
    </div>
  )
}

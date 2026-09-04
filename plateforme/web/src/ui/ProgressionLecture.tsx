import { useEffect, useState } from 'react'
import './ProgressionLecture.css'

/**
 * Barre de progression de lecture, collée sous l'en-tête.
 *
 * Elle répond à la question qu'on se pose en arrivant sur un texte : combien
 * il en reste. Sur une leçon de trois minutes, c'est ce qui empêche de la
 * refermer en croyant qu'elle est longue.
 *
 * `scrollY` est lu dans un `requestAnimationFrame` : l'événement de défilement
 * part à chaque pixel, et recalculer la mise en page à cette cadence fait
 * saccader la page sur les machines des salles.
 */
export function ProgressionLecture() {
  const [part, setPart] = useState(0)

  useEffect(() => {
    let demande = 0

    function mesurer() {
      const parcourable = document.documentElement.scrollHeight - innerHeight
      // Une page plus courte que la fenêtre est lue en entier d'emblée : sans
      // ce cas, on divise par zéro et la barre part à NaN.
      setPart(parcourable <= 0 ? 1 : Math.min(1, Math.max(0, scrollY / parcourable)))
      demande = 0
    }

    function auDefilement() {
      if (demande === 0) demande = requestAnimationFrame(mesurer)
    }

    mesurer()
    addEventListener('scroll', auDefilement, { passive: true })
    addEventListener('resize', auDefilement)
    return () => {
      cancelAnimationFrame(demande)
      removeEventListener('scroll', auDefilement)
      removeEventListener('resize', auDefilement)
    }
  }, [])

  return (
    <div className="lecture" aria-hidden="true">
      <span className="lecture__part" style={{ transform: `scaleX(${part})` }} />
    </div>
  )
}

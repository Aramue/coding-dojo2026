import { useEffect, useMemo, useState } from 'react'
import { FluxQuiz, type Photographie } from './flux'

/**
 * Branche un écran sur la sonnette et sa relève.
 *
 * `lire`, `presentation` et `repliMs` sont lus une fois, au montage : ils ne
 * dépendent que de la session (le client de l'élève, le code du professeur),
 * qui ne change pas sans remonter l'écran.
 *
 * `actif` à faux suspend tout — sonnette fermée, relève arrêtée — et garde la
 * dernière photographie. Le bandeau de l'élève se suspend ainsi sur /quiz, où
 * l'écran de la partie a sa propre sonnette.
 */
export function useFluxQuiz<E extends Photographie>(
  lire: () => Promise<E>,
  presentation: () => Record<string, string>,
  { actif = true, repliMs }: { actif?: boolean; repliMs?: number } = {},
) {
  const [etat, setEtat] = useState<E | null>(null)
  const [ecartMs, setEcartMs] = useState(0)
  const [erreur, setErreur] = useState<string | null>(null)

  const flux = useMemo(
    () =>
      new FluxQuiz<E>({
        lire,
        presentation,
        onEtat: (nouvel, ecart) => {
          setEtat(nouvel)
          setEcartMs(ecart)
        },
        onErreur: setErreur,
        repliMs,
      }),
    // Volontairement au montage seulement : voir plus haut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    if (!actif) return
    flux.demarrer()
    return () => flux.arreter()
  }, [flux, actif])

  return { etat, ecartMs, erreur, flux }
}

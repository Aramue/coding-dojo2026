import { useEffect, useMemo, useState } from 'react'
import { FluxQuiz, type Photographie } from './flux'

/**
 * Branche un écran sur la sonnette et sa relève.
 *
 * `lire` et `presentation` sont lus une fois, au montage : ils ne dépendent
 * que de la session (le client de l'élève, le code du professeur), qui ne
 * change pas sans remonter l'écran.
 */
export function useFluxQuiz<E extends Photographie>(
  lire: () => Promise<E>,
  presentation: () => Record<string, string>,
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
      }),
    // Volontairement au montage seulement : voir plus haut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    flux.demarrer()
    return () => flux.arreter()
  }, [flux])

  return { etat, ecartMs, erreur, flux }
}

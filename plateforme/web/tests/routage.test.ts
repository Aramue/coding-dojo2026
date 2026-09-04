import { describe, expect, it, vi } from 'vitest'
import { analyser, naviguer, versChemin } from '../src/routage'

describe('analyser', () => {
  it('reconnait la racine comme la connexion', () => {
    expect(analyser('/')).toEqual({ vue: 'connexion' })
    expect(analyser('')).toEqual({ vue: 'connexion' })
  })

  it('reconnait le tableau de bord professeur', () => {
    expect(analyser('/prof')).toEqual({ vue: 'prof' })
    expect(analyser('/prof/')).toEqual({ vue: 'prof' })
  })

  it('ne confond pas /prof avec une notion', () => {
    expect(analyser('/prof/cours')).toEqual({ vue: 'cours', notion: 'prof' })
  })

  it('reconnait une page de cours', () => {
    expect(analyser('/variables/cours')).toEqual({ vue: 'cours', notion: 'variables' })
  })

  it('reconnait une liste d exercices', () => {
    expect(analyser('/types/exercices')).toEqual({ vue: 'exercices', notion: 'types' })
  })

  it('reconnait un exercice', () => {
    expect(analyser('/saisie/exercices/12')).toEqual({
      vue: 'exercice',
      notion: 'saisie',
      numero: 12,
    })
  })

  it('tolere une barre finale', () => {
    expect(analyser('/variables/cours/')).toEqual({ vue: 'cours', notion: 'variables' })
  })

  it('accepte tout identifiant de notion bien forme', () => {
    // Le routeur ne connait pas le vocabulaire des notions : il vit dans le
    // contenu publie. Une notion absente donnera une page « introuvable ».
    expect(analyser('/algebre/cours')).toEqual({ vue: 'cours', notion: 'algebre' })
  })

  it('rejette un identifiant de notion mal forme', () => {
    expect(analyser('/Variables/cours')).toEqual({ vue: 'inconnue' })
    expect(analyser('/var1/cours')).toEqual({ vue: 'inconnue' })
    expect(analyser('/a/cours')).toEqual({ vue: 'inconnue' })
  })

  it('rejette un numero non numerique', () => {
    expect(analyser('/saisie/exercices/abc')).toEqual({ vue: 'inconnue' })
  })

  it('rejette un numero hors bornes', () => {
    expect(analyser('/saisie/exercices/0')).toEqual({ vue: 'inconnue' })
    expect(analyser('/saisie/exercices/999')).toEqual({ vue: 'inconnue' })
  })

  it('rejette un chemin trop long', () => {
    expect(analyser('/variables/cours/en/trop')).toEqual({ vue: 'inconnue' })
  })

  it('rejette une page inconnue dans une notion connue', () => {
    expect(analyser('/variables/revision')).toEqual({ vue: 'inconnue' })
  })

  it('rejette un numero sous une page qui n en prend pas', () => {
    expect(analyser('/variables/cours/3')).toEqual({ vue: 'inconnue' })
  })
})

describe('versChemin', () => {
  it('reconstruit chaque destination', () => {
    expect(versChemin({ vue: 'connexion' })).toBe('/')
    expect(versChemin({ vue: 'cours', notion: 'variables' })).toBe('/variables/cours')
    expect(versChemin({ vue: 'exercices', notion: 'types' })).toBe('/types/exercices')
    expect(versChemin({ vue: 'exercice', notion: 'saisie', numero: 12 })).toBe(
      '/saisie/exercices/12',
    )
    expect(versChemin({ vue: 'prof' })).toBe('/prof')
    expect(versChemin({ vue: 'inconnue' })).toBe('/')
  })

  it('fait l aller-retour sans perte', () => {
    for (const chemin of ['/', '/prof', '/variables/cours', '/types/exercices', '/saisie/exercices/12']) {
      expect(versChemin(analyser(chemin))).toBe(chemin)
    }
  })
})

describe('naviguer', () => {
  it('change l URL sans recharger, et previent les abonnes', () => {
    const pushState = vi.spyOn(history, 'pushState')
    const abonne = vi.fn()
    addEventListener('popstate', abonne)

    naviguer({ vue: 'cours', notion: 'types' })

    expect(pushState).toHaveBeenCalledWith(null, '', '/types/cours')
    expect(abonne).toHaveBeenCalled()

    removeEventListener('popstate', abonne)
    pushState.mockRestore()
  })
})

describe('useRoute', () => {
  it("suit la navigation, et se desabonne au demontage", async () => {
    const { renderHook, act } = await import('@testing-library/react')
    const { useRoute } = await import('../src/routage')

    history.pushState(null, '', '/')
    const { result, unmount } = renderHook(() => useRoute())
    expect(result.current).toEqual({ vue: 'connexion' })

    act(() => naviguer({ vue: 'exercice', notion: 'types', numero: 3 }))
    expect(result.current).toEqual({ vue: 'exercice', notion: 'types', numero: 3 })

    // Apres demontage, l'abonnement popstate ne doit plus rien mettre a jour :
    // un ecouteur laisse en place fuit a chaque montage.
    const dernier = result.current
    unmount()
    naviguer({ vue: 'cours', notion: 'saisie' })
    expect(result.current).toBe(dernier)

    history.pushState(null, '', '/')
  })
})

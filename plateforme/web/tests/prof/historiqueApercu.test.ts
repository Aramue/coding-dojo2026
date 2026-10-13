import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useHistoriqueApercu } from '../../src/prof/historiqueApercu'

const EX1 = { vue: 'exercice', notion: 'afficher', numero: 1 } as const
const EX2 = { vue: 'exercice', notion: 'afficher', numero: 2 } as const

beforeEach(() => {
  // Une entrée propre, sur /prof, sans aperçu : le tableau de bord.
  history.pushState(null, '', '/prof')
})

describe("useHistoriqueApercu — l'aperçu dans l'historique du navigateur", () => {
  it('est fermé tant que rien ne l a ouvert', () => {
    const { result } = renderHook(() => useHistoriqueApercu())
    expect(result.current.apercu).toBeNull()
  })

  it('ouvrir empile une entrée, sans changer d adresse', () => {
    const { result } = renderHook(() => useHistoriqueApercu())
    const longueur = history.length
    act(() => result.current.ouvrir(EX1))
    expect(result.current.apercu).toMatchObject({ ou: EX1, solutions: false, profondeur: 1 })
    expect(history.length).toBe(longueur + 1)
    expect(location.pathname).toBe('/prof')
  })

  it('le bouton Retour revient à la page d avant, puis referme', async () => {
    // Le défaut d'origine : après plusieurs exercices, Retour faisait quitter
    // le tableau de bord au lieu de revenir à l'exercice précédent.
    const { result } = renderHook(() => useHistoriqueApercu())
    act(() => result.current.ouvrir(undefined, true))
    act(() => result.current.aller(EX1, 0))
    act(() => result.current.aller(EX2, 0))
    expect(result.current.apercu).toMatchObject({ ou: EX2, profondeur: 3, solutions: true })

    act(() => history.back())
    await waitFor(() => expect(result.current.apercu?.ou).toEqual(EX1))
    expect(result.current.apercu?.solutions).toBe(true)

    act(() => history.back())
    await waitFor(() => expect(result.current.apercu?.profondeur).toBe(1))
    expect(result.current.apercu?.ou).toBeUndefined()

    act(() => history.back())
    await waitFor(() => expect(result.current.apercu).toBeNull())
    expect(location.pathname).toBe('/prof')
  })

  it('une page retrouvée par Retour l est là où on l avait laissée', async () => {
    const { result } = renderHook(() => useHistoriqueApercu())
    act(() => result.current.ouvrir(EX1))
    // On quitte EX1 en étant descendu de 640 pixels.
    act(() => result.current.aller(EX2, 640))
    expect(result.current.apercu?.defilement).toBe(0) // une page neuve s'ouvre en haut

    act(() => history.back())
    await waitFor(() => expect(result.current.apercu?.ou).toEqual(EX1))
    expect(result.current.apercu?.defilement).toBe(640)
  })

  it('fermer revient d un coup au tableau de bord, sans laisser de pages derrière', async () => {
    const { result } = renderHook(() => useHistoriqueApercu())
    act(() => result.current.ouvrir())
    act(() => result.current.aller(EX1, 0))
    act(() => result.current.aller(EX2, 0))

    act(() => result.current.fermer())
    await waitFor(() => expect(result.current.apercu).toBeNull())
    // On est revenu sur l'entrée du tableau de bord : Retour n'y rouvre rien.
    expect(history.state).toBeNull()
  })

  it('le bouton Suivant rouvre l aperçu refermé par Retour', async () => {
    const { result } = renderHook(() => useHistoriqueApercu())
    act(() => result.current.ouvrir(EX1))
    act(() => history.back())
    await waitFor(() => expect(result.current.apercu).toBeNull())
    act(() => history.forward())
    await waitFor(() => expect(result.current.apercu?.ou).toEqual(EX1))
  })

  it('un rechargement rouvre l aperçu où il était', () => {
    history.pushState({ apercu: { ou: EX2, solutions: true, profondeur: 2, defilement: 120 } }, '')
    const { result } = renderHook(() => useHistoriqueApercu())
    expect(result.current.apercu).toEqual({ ou: EX2, solutions: true, profondeur: 2, defilement: 120 })
  })

  it('ignore un état d historique qui n est pas le sien', () => {
    history.pushState({ apercu: { profondeur: 'trois' } }, '')
    expect(renderHook(() => useHistoriqueApercu()).result.current.apercu).toBeNull()
    history.pushState({ autre: true }, '')
    expect(renderHook(() => useHistoriqueApercu()).result.current.apercu).toBeNull()
  })

  it('aller et fermer sans aperçu ouvert ne font rien', () => {
    const { result } = renderHook(() => useHistoriqueApercu())
    const longueur = history.length
    act(() => result.current.aller(EX1, 0))
    act(() => result.current.fermer())
    expect(history.length).toBe(longueur)
    expect(result.current.apercu).toBeNull()
  })
})

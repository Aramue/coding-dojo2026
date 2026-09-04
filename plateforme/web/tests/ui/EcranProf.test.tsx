import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EcranProf } from '../../src/ui/EcranProf'

const CLE = 'dojo.code-prof'

beforeEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.includes('prof/seance')
        ? { ok: true, json: async () => ({ eleves: [] }) }
        : { ok: true, json: async () => [] },
    ),
  )
})

describe('EcranProf — la porte', () => {
  it('demande le code avant de montrer quoi que ce soit de la classe', () => {
    render(<EcranProf />)
    expect(screen.getByLabelText(/code professeur/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /séance en cours/i })).toBeNull()
  })

  it('masque la saisie : le tableau se projette souvent au mur', () => {
    render(<EcranProf />)
    expect(screen.getByLabelText(/code professeur/i)).toHaveAttribute('type', 'password')
  })

  it("n'ouvre pas sur un champ vide", async () => {
    render(<EcranProf />)
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeDisabled()
  })

  it('ouvre le tableau une fois le code saisi', async () => {
    render(<EcranProf />)
    await userEvent.type(screen.getByLabelText(/code professeur/i), 'code-de-test')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(await screen.findByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
  })

  it('garde le code le temps de l onglet, jamais au-dela', async () => {
    // sessionStorage et non localStorage : la machine de la salle est partagee.
    render(<EcranProf />)
    await userEvent.type(screen.getByLabelText(/code professeur/i), 'code-de-test')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(sessionStorage.getItem(CLE)).toBe('code-de-test')
    expect(localStorage.getItem(CLE)).toBeNull()
  })

  it("rouvre tout seul sur un code deja memorise", async () => {
    sessionStorage.setItem(CLE, 'code-de-test')
    render(<EcranProf />)
    expect(await screen.findByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
  })

  it('referme la session et efface le code', async () => {
    sessionStorage.setItem(CLE, 'code-de-test')
    render(<EcranProf />)
    await userEvent.click(screen.getByRole('button', { name: /fermer la session/i }))
    expect(sessionStorage.getItem(CLE)).toBeNull()
    expect(screen.getByLabelText(/code professeur/i)).toBeInTheDocument()
  })

  it("ignore un code fait d'espaces", async () => {
    render(<EcranProf />)
    await userEvent.type(screen.getByLabelText(/code professeur/i), '   ')
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeDisabled()
  })

  it("s'ouvre quand meme si le navigateur refuse d'ecrire", async () => {
    // Navigation privee, cookies bloques : sans ce filet, la porte reste close
    // et le professeur n'a aucun moyen de comprendre pourquoi.
    const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('refus')
    })
    render(<EcranProf />)
    await userEvent.type(screen.getByLabelText(/code professeur/i), 'code-de-test')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(await screen.findByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
    ecrire.mockRestore()
  })

  it("ne plante pas quand le navigateur refuse meme de lire", () => {
    const lire = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('refus')
    })
    render(<EcranProf />)
    expect(screen.getByLabelText(/code professeur/i)).toBeInTheDocument()
    lire.mockRestore()
  })
})

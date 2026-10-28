import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tp } from '../../src/contenu/types'
import type { Executeur } from '../../src/execution/executeur'
import { PageTp } from '../../src/ui/PageTp'

const executeur = {
  executer: vi.fn(async () => ({
    stdout: '0 1\n',
    erreur: null,
    variables: {},
    dureeMs: 3,
    timeout: false,
  })),
} as unknown as Executeur

const TP: Tp = {
  id: 'stegano',
  chapitre: 'stegano',
  titre: "Le message caché dans l'image",
  dureeMin: 90,
  introduction: [
    { type: 'paragraphe', texte: 'Une image cache un **message**.' },
    { type: 'attention', texte: 'Garde le PNG.' },
  ],
  materiel: ["L'image `image_with_message.png`"],
  etapes: [
    {
      titre: "Charger l'image",
      objectif: 'Obtenir la matrice.',
      blocs: [
        { type: 'code', legende: 'Charger', python: 'print(1)\n', executable: false, entrees: [] },
        { type: 'verifier', texte: "Deux nombres s'affichent." },
        { type: 'indice', texte: "Regarde l'ordre des variables." },
      ],
    },
    {
      titre: 'Appeler get_lsb',
      objectif: 'Lire deux bits.',
      blocs: [
        { type: 'code', legende: 'Essai', python: 'print(0, 1)\n', executable: true, entrees: [] },
      ],
    },
  ],
}

beforeEach(() => sessionStorage.clear())

describe('PageTp', () => {
  it("annonce le TP, sa durée et son nombre d'étapes", () => {
    render(<PageTp tp={TP} executeur={executeur} />)
    expect(screen.getByRole('heading', { level: 1, name: TP.titre })).toBeInTheDocument()
    expect(screen.getByText(/Environ 90 min · 2 étapes · 0 terminée$/)).toBeInTheDocument()
    expect(screen.getByText('message').tagName).toBe('STRONG')
    expect(screen.getByText('Garde le PNG.')).toBeInTheDocument()
  })

  it('liste le matériel', () => {
    render(<PageTp tp={TP} executeur={executeur} />)
    const materiel = screen.getByRole('region', { name: "Ce qu'il te faut" })
    expect(within(materiel).getByText('image_with_message.png')).toBeInTheDocument()
  })

  it("ne montre pas de matériel quand il n'y en a pas", () => {
    render(<PageTp tp={{ ...TP, materiel: [] }} executeur={executeur} />)
    expect(screen.queryByRole('region', { name: "Ce qu'il te faut" })).toBeNull()
  })

  it('numérote les étapes et donne leur objectif', () => {
    render(<PageTp tp={TP} executeur={executeur} />)
    expect(screen.getByRole('heading', { name: "Étape 1 : Charger l'image" })).toBeInTheDocument()
    expect(screen.getByText('Obtenir la matrice.')).toBeInTheDocument()
  })

  it("dit quoi vérifier, et replie l'indice jusqu'à ce qu'on l'ouvre", async () => {
    render(<PageTp tp={TP} executeur={executeur} />)
    expect(screen.getByText(/À vérifier avant de continuer/)).toBeInTheDocument()
    const indice = screen.getByText('Indice, si tu bloques').closest('details')!
    expect(indice).not.toHaveAttribute('open')
    await userEvent.click(screen.getByText('Indice, si tu bloques'))
    expect(indice).toHaveAttribute('open')
  })

  it('fait essayer un exemple exécutable, et pas les autres', async () => {
    render(<PageTp tp={TP} executeur={executeur} />)
    const boutons = screen.getAllByRole('button', { name: 'Essayer' })
    expect(boutons).toHaveLength(1)
    await userEvent.click(boutons[0]!)
    expect(screen.queryByRole('button', { name: 'Essayer' })).toBeNull()
  })

  it("coche une étape, la compte, et s'en souvient le temps de l'onglet", async () => {
    const { unmount } = render(<PageTp tp={TP} executeur={executeur} />)
    await userEvent.click(screen.getByRole('checkbox', { name: "J'ai terminé l'étape 1" }))
    await userEvent.click(screen.getByRole('checkbox', { name: "J'ai terminé l'étape 2" }))
    expect(screen.getByText(/2 terminées$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: "J'ai terminé l'étape 2" }))
    unmount()

    render(<PageTp tp={TP} executeur={executeur} />)
    expect(screen.getByRole('checkbox', { name: "J'ai terminé l'étape 1" })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: "J'ai terminé l'étape 2" })).not.toBeChecked()
  })

  it('ignore une mémoire illisible ou étrangère', () => {
    sessionStorage.setItem('dojo.tp.stegano', '{pas du json')
    const { unmount } = render(<PageTp tp={TP} executeur={executeur} />)
    expect(screen.getByText(/0 terminée$/)).toBeInTheDocument()
    unmount()
    sessionStorage.setItem('dojo.tp.stegano', JSON.stringify({ etape: 1 }))
    render(<PageTp tp={TP} executeur={executeur} />)
    expect(screen.getByText(/0 terminée$/)).toBeInTheDocument()
  })

  it("ne garde que des numéros d'étape", () => {
    sessionStorage.setItem('dojo.tp.stegano', JSON.stringify([0, 'x']))
    render(<PageTp tp={TP} executeur={executeur} />)
    expect(screen.getByText(/1 terminée$/)).toBeInTheDocument()
  })

  it('coche quand même quand le stockage est refusé', () => {
    const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('refusé')
    })
    render(<PageTp tp={TP} executeur={executeur} />)
    fireEvent.click(screen.getByRole('checkbox', { name: "J'ai terminé l'étape 1" }))
    expect(screen.getByRole('checkbox', { name: "J'ai terminé l'étape 1" })).toBeChecked()
    ecrire.mockRestore()
  })
})

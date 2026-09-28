import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EntreeDuDepot, PoigneeFichier } from '../../../src/atelier/depot'
import { Depot, type Catalogue } from '../../../src/ui/atelier/Depot'

function entree(chemin: string, titre: string | null): EntreeDuDepot {
  const nom = chemin.split('/').at(-1)!
  return { chemin, nom, titre, poignee: { name: nom } as PoigneeFichier }
}

const CATALOGUE: Catalogue = {
  nom: 'contenu',
  entrees: [
    entree('chapitre-1/seance-2/lecons/c2-comparer.yaml', 'Comparer'),
    entree('chapitre-1/seance-3/s3-07.yaml', 'La boucle qui compte mal'),
    entree('chapitre-1/seance-3/s3-07-expert.yaml', 'La boucle, en mieux'),
    entree('chapitre-1/seance-3/s3-12.yaml', 'Leçon de choses'),
    entree('chapitre-1/seance-3/s3-13.yaml', null),
  ],
}

function monter(options: Partial<Parameters<typeof Depot>[0]> = {}) {
  const onOuvrirDossier = vi.fn()
  const onReprendre = vi.fn()
  render(
    <Depot
      possible
      catalogue={null}
      enCours={false}
      onOuvrirDossier={onOuvrirDossier}
      onReprendre={onReprendre}
      {...options}
    />,
  )
  return { onOuvrirDossier, onReprendre }
}

/** Les entrées proposées, par leur identifiant. */
function proposees(): string[] {
  const depot = screen.getByRole('region', { name: 'Dépôt' })
  return within(depot)
    .queryAllByRole('button')
    .filter((b) => b.classList.contains('depot__fichier'))
    .map((b) => b.querySelector('.mono')!.textContent!)
}

describe('Depot — avant le dossier', () => {
  it('dit sur quels navigateurs il existe, là où il ne peut pas', () => {
    monter({ possible: false })
    expect(screen.getByText(/Sur Chrome ou Edge/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('propose d ouvrir le dossier, et dit lequel choisir', async () => {
    const { onOuvrirDossier } = monter()
    expect(screen.getByText(/la racine du dépôt, ou son dossier/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir le dossier du dépôt' }))

    expect(onOuvrirDossier).toHaveBeenCalledOnce()
  })

  it('se tait pendant la lecture du dossier', () => {
    monter({ enCours: true })
    expect(screen.getByRole('button', { name: 'Lecture du dossier…' })).toBeDisabled()
  })
})

describe('Depot — le catalogue', () => {
  it('nomme le dossier ouvert et compte ses fichiers', () => {
    monter({ catalogue: CATALOGUE })
    expect(screen.getByRole('region', { name: 'Dépôt' })).toHaveTextContent('contenu — 5 fichiers')
  })

  it('accorde le compte au singulier', () => {
    monter({ catalogue: { nom: 'seance-3', entrees: [CATALOGUE.entrees[1]!] } })
    expect(screen.getByRole('region', { name: 'Dépôt' })).toHaveTextContent('seance-3 — 1 fichier')
  })

  it('montre chaque fichier avec son titre, et le chemin au survol', () => {
    monter({ catalogue: CATALOGUE })
    const bouton = screen.getByRole('button', { name: 's3-07 La boucle qui compte mal' })
    expect(bouton).toHaveAttribute('title', 'chapitre-1/seance-3/s3-07.yaml')
  })

  it("dit quand un titre n'a pas pu être lu", () => {
    monter({ catalogue: CATALOGUE })
    expect(screen.getByRole('button', { name: 's3-13 titre illisible' })).toBeInTheDocument()
  })

  it('reprend le fichier sur lequel on clique', async () => {
    const { onReprendre } = monter({ catalogue: CATALOGUE })
    await userEvent.click(screen.getByRole('button', { name: /^s3-07 / }))
    expect(onReprendre).toHaveBeenCalledWith(CATALOGUE.entrees[1])
  })

  it('permet de changer de dossier', async () => {
    const { onOuvrirDossier } = monter({ catalogue: CATALOGUE })
    await userEvent.click(screen.getByRole('button', { name: 'Changer de dossier' }))
    expect(onOuvrirDossier).toHaveBeenCalledOnce()
  })

  it('dit quoi faire quand le dossier ne contient rien', () => {
    // Le mauvais dossier choisi : le message doit nommer le bon.
    monter({ catalogue: { nom: 'Documents', entrees: [] } })
    expect(screen.getByText(/Aucun exercice ni leçon dans ce dossier/)).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})

describe('Depot — la recherche', () => {
  it('trouve par identifiant', () => {
    monter({ catalogue: CATALOGUE })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 's3-07' } })
    expect(proposees()).toEqual(['s3-07', 's3-07-expert'])
  })

  it('trouve par titre, sans casse ni accents', () => {
    // On se souvient de « la boucle », rarement de s3-07.
    monter({ catalogue: CATALOGUE })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'LECON' } })
    expect(proposees()).toEqual(['s3-12'])
  })

  it('exige tous les mots, dans n importe quel ordre', () => {
    monter({ catalogue: CATALOGUE })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mal boucle' } })
    expect(proposees()).toEqual(['s3-07'])
  })

  it('dit quand rien ne correspond', () => {
    monter({ catalogue: CATALOGUE })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  xyzzy ' } })
    expect(screen.getByText('Rien ne correspond à « xyzzy ».')).toBeInTheDocument()
  })

  it('reprend le premier trouvé sur Entrée', async () => {
    // Taper `s3-07` puis Entrée suffit : la variante experte vient après.
    const { onReprendre } = monter({ catalogue: CATALOGUE })
    await userEvent.type(screen.getByRole('searchbox'), 's3-07{Enter}')
    expect(onReprendre).toHaveBeenCalledWith(CATALOGUE.entrees[1])
  })

  it('ne reprend rien sur Entrée quand rien ne correspond', async () => {
    const { onReprendre } = monter({ catalogue: CATALOGUE })
    await userEvent.type(screen.getByRole('searchbox'), 'xyzzy{Enter}')
    expect(onReprendre).not.toHaveBeenCalled()
  })

  it("n'agit que sur Entrée", () => {
    const { onReprendre } = monter({ catalogue: CATALOGUE })
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Tab' })
    expect(onReprendre).not.toHaveBeenCalled()
  })
})

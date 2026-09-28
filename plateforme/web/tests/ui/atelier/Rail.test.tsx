import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Rail, type Ouvert } from '../../../src/ui/atelier/Rail'

function monter(ouverts: Ouvert[] = [], courant: number | null = null) {
  const onChoisir = vi.fn()
  const onDeposer = vi.fn()
  const onFermer = vi.fn()
  render(
    <Rail
      ouverts={ouverts}
      courant={courant}
      onChoisir={onChoisir}
      onDeposer={onDeposer}
      onFermer={onFermer}
    />,
  )
  return { onChoisir, onDeposer, onFermer }
}

/** Un lâcher de fichiers, tel que le navigateur le produit. */
function lacher(noms: string[]) {
  const fichiers = noms.map((nom) => new File(['id: s1-01\n'], nom, { type: 'text/yaml' }))
  fireEvent.drop(screen.getByLabelText('Fichiers ouverts'), { dataTransfer: { files: fichiers } })
  return fichiers
}

describe('Rail — la zone de dépôt', () => {
  it('explique quoi y déposer tant qu elle est vide', () => {
    monter()
    expect(screen.getByText(/Dépose ici un ou plusieurs fichiers/)).toBeInTheDocument()
  })

  it('remonte les fichiers lâchés', () => {
    const { onDeposer } = monter()
    lacher(['s1-01.yaml', 's1-02.yaml'])
    expect(onDeposer).toHaveBeenCalledOnce()
    expect(onDeposer.mock.calls[0]![0].map((f: File) => f.name)).toEqual([
      's1-01.yaml',
      's1-02.yaml',
    ])
  })

  it('ignore ce qui n est pas un .yaml', () => {
    // Une capture d'écran lâchée par erreur ne doit rien déclencher.
    const { onDeposer } = monter()
    fireEvent.drop(screen.getByLabelText('Fichiers ouverts'), {
      dataTransfer: { files: [new File([''], 'photo.png')] },
    })
    expect(onDeposer).not.toHaveBeenCalled()
  })

  it('se signale pendant le survol, et cesse en sortant', () => {
    monter()
    const zone = screen.getByLabelText('Fichiers ouverts')
    fireEvent.dragOver(zone)
    expect(zone).toHaveAttribute('data-survole', 'true')
    fireEvent.dragLeave(zone)
    expect(zone).toHaveAttribute('data-survole', 'false')
  })

  it('cesse de se signaler une fois le fichier lâché', () => {
    monter()
    const zone = screen.getByLabelText('Fichiers ouverts')
    fireEvent.dragOver(zone)
    lacher(['s1-01.yaml'])
    expect(zone).toHaveAttribute('data-survole', 'false')
  })
})

describe('Rail — les fichiers ouverts', () => {
  const ACCEPTE: Ouvert = {
    cle: 10,
    nom: 's1-01.yaml',
    sorte: 'exercice',
    brouillon: { id: 's1-01' },
  }
  const SECOND: Ouvert = { ...ACCEPTE, cle: 11, nom: 's1-02.yaml' }
  const REFUSE: Ouvert = {
    cle: 12,
    nom: 's1-99.yaml',
    sorte: 'exercice',
    brouillon: null,
    refus: 'champ inconnu : surnom.',
  }

  it('marque celui qu on est en train d éditer, par sa clé', () => {
    monter([ACCEPTE, SECOND], 11)
    expect(screen.getByRole('button', { name: 'Ouvrir s1-02.yaml' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Ouvrir s1-01.yaml' })).toHaveAttribute('aria-current', 'false')
  })

  it('ouvre celui sur lequel on clique, désigné par sa clé et non par son rang', async () => {
    const { onChoisir } = monter([ACCEPTE, SECOND], 10)
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir s1-02.yaml' }))
    expect(onChoisir).toHaveBeenCalledWith(11)
  })

  it('signale un fichier modifié, y compris au lecteur d écran', () => {
    // Le nom explicite du bouton masque son contenu : « modifié » doit
    // passer par la description.
    monter([{ ...ACCEPTE, modifie: true }, SECOND])
    const modifie = screen.getByRole('button', { name: 'Ouvrir s1-01.yaml' })
    expect(modifie).toHaveAccessibleDescription('modifié')
    expect(screen.getByRole('button', { name: 'Ouvrir s1-02.yaml' })).not.toHaveAttribute(
      'aria-describedby',
    )
  })

  it('garde un fichier refusé dans le rail, avec sa raison', () => {
    // Le retirer en silence laisserait croire qu'on ne l'a jamais lâché.
    monter([REFUSE])
    expect(screen.getByText('champ inconnu : surnom.')).toBeInTheDocument()
  })

  it("n'ouvre pas un fichier refusé", async () => {
    const { onChoisir } = monter([REFUSE])
    expect(screen.getByRole('button', { name: 'Ouvrir s1-99.yaml' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir s1-99.yaml' }))
    expect(onChoisir).not.toHaveBeenCalled()
  })

  it("prévient qu'un fichier commenté perdra ses commentaires", () => {
    monter([{ ...ACCEPTE, commente: true }])
    expect(screen.getByText(/l'export ne les rendra pas/)).toBeInTheDocument()
  })

  it("ne le dit pas sur un fichier refusé, qui n'ira nulle part", () => {
    monter([{ ...REFUSE, commente: true }])
    expect(screen.queryByText(/l'export ne les rendra pas/)).toBeNull()
  })

  it('retire un fichier du rail', async () => {
    const { onFermer } = monter([ACCEPTE, SECOND], 10)
    await userEvent.click(screen.getByRole('button', { name: 'Retirer s1-02.yaml' }))
    expect(onFermer).toHaveBeenCalledWith(11)
  })
})

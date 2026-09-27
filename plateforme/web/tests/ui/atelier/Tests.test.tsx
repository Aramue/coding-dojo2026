import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Test } from '../../../src/validation/types'
import { Tests } from '../../../src/ui/atelier/Tests'

function monter(tests: Test[] = []) {
  const onChange = vi.fn()
  const onRemplir = vi.fn()
  render(<Tests tests={tests} onChange={onChange} onRemplir={onRemplir} />)
  return { onChange, onRemplir }
}

describe('Tests — ajouter et retirer', () => {
  it.each([
    ['Sortie', { type: 'sortie', entrees: [], attendu: '' }],
    ['Variable', { type: 'variable', nom: '' }],
    ['QCM', { type: 'qcm', options: ['', ''], bonneReponse: 0 }],
    ['Interdit', { type: 'interdit', motif: '' }],
    ['Contient', { type: 'contient', motif: '' }],
  ])('ajoute une carte %s', async (libelle, attendu) => {
    const { onChange } = monter()
    await userEvent.click(screen.getByRole('button', { name: `+ ${libelle}` }))
    expect(onChange).toHaveBeenCalledWith([attendu])
  })

  it('retire la carte visée, et elle seule', async () => {
    const tests: Test[] = [
      { type: 'interdit', motif: 'a' },
      { type: 'interdit', motif: 'b' },
    ]
    const { onChange } = monter(tests)
    await userEvent.click(screen.getAllByRole('button', { name: 'Retirer' })[0]!)
    expect(onChange).toHaveBeenCalledWith([{ type: 'interdit', motif: 'b' }])
  })
})

describe('Tests — chaque carte ne montre que ses champs', () => {
  it("n'offre pas d'entrées à un motif interdit", () => {
    monter([{ type: 'interdit', motif: 'a' }])
    expect(screen.queryByLabelText(/Entrées simulées/)).toBeNull()
    expect(screen.getByLabelText('Motif')).toBeInTheDocument()
  })

  it("n'offre pas de motif à un test de sortie", () => {
    monter([{ type: 'sortie', entrees: [], attendu: '' }])
    expect(screen.queryByLabelText('Motif')).toBeNull()
    expect(screen.getByLabelText(/Entrées simulées/)).toBeInTheDocument()
  })

  it("n'offre la maîtrise qu'à un contient", () => {
    monter([{ type: 'contient', motif: 'for' }])
    expect(screen.getByText(/Critère de maîtrise/)).toBeInTheDocument()
  })

  it("ne l'offre pas à un interdit", () => {
    monter([{ type: 'interdit', motif: 'for' }])
    expect(screen.queryByText(/Critère de maîtrise/)).toBeNull()
  })
})

describe("Tests — l'attendu ne se tape pas", () => {
  it('le montre en lecture seule', () => {
    monter([{ type: 'sortie', entrees: [], attendu: 'Bonjour' }])
    expect(screen.getByLabelText('Attendu')).toHaveAttribute('readonly')
  })

  it('demande son calcul depuis la solution, pour la bonne carte', async () => {
    const { onRemplir } = monter([
      { type: 'interdit', motif: 'x' },
      { type: 'sortie', entrees: [], attendu: '' },
    ])
    await userEvent.click(screen.getByRole('button', { name: /Remplir depuis la solution/ }))
    expect(onRemplir).toHaveBeenCalledWith(1)
  })

  it("n'offre ce bouton qu'aux tests de sortie", () => {
    monter([{ type: 'variable', nom: 'age' }])
    expect(screen.queryByRole('button', { name: /Remplir/ })).toBeNull()
  })
})

describe('Tests — ce que chaque carte remonte', () => {
  it('découpe les entrées, une par ligne', async () => {
    const { onChange } = monter([{ type: 'sortie', entrees: [], attendu: '' }])
    await userEvent.type(screen.getByLabelText(/Entrées simulées/), 'a')
    expect(onChange).toHaveBeenCalledWith([{ type: 'sortie', entrees: ['a'], attendu: '' }])
  })

  it('rend une liste vide plutôt qu une entrée vide', async () => {
    const { onChange } = monter([{ type: 'sortie', entrees: ['a'], attendu: '' }])
    await userEvent.clear(screen.getByLabelText(/Entrées simulées/))
    expect(onChange).toHaveBeenCalledWith([{ type: 'sortie', entrees: [], attendu: '' }])
  })

  it("bascule l'exigence du format exact", async () => {
    const { onChange } = monter([{ type: 'sortie', entrees: [], attendu: '' }])
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith([
      { type: 'sortie', entrees: [], attendu: '', exigeExact: true },
    ])
  })

  it('remonte le nom d une variable', async () => {
    const { onChange } = monter([{ type: 'variable', nom: '' }])
    await userEvent.type(screen.getByLabelText('Nom de la variable'), 'a')
    expect(onChange).toHaveBeenCalledWith([{ type: 'variable', nom: 'a' }])
  })

  it('remonte la valeur et le type attendus', async () => {
    const { onChange } = monter([{ type: 'variable', nom: 'a' }])
    await userEvent.type(screen.getByLabelText(/Valeur attendue/), '7')
    await userEvent.selectOptions(screen.getByLabelText('Type attendu'), 'int')
    expect(onChange).toHaveBeenCalledWith([{ type: 'variable', nom: 'a', valeurAttendue: '7' }])
    expect(onChange).toHaveBeenCalledWith([{ type: 'variable', nom: 'a', typeAttendu: 'int' }])
  })

  it('les efface quand on les vide, au lieu d écrire du vide', async () => {
    const { onChange } = monter([
      { type: 'variable', nom: 'a', valeurAttendue: '7', typeAttendu: 'int' },
    ])
    await userEvent.clear(screen.getByLabelText(/Valeur attendue/))
    await userEvent.selectOptions(screen.getByLabelText('Type attendu'), '')
    expect(onChange).toHaveBeenCalledWith([
      { type: 'variable', nom: 'a', valeurAttendue: undefined, typeAttendu: 'int' },
    ])
    expect(onChange).toHaveBeenCalledWith([
      { type: 'variable', nom: 'a', valeurAttendue: '7', typeAttendu: undefined },
    ])
  })

  it('numérote la bonne réponse à partir de 1, pas de 0', async () => {
    // Le professeur lit « la deuxième option », pas « l'indice 1 ».
    const { onChange } = monter([{ type: 'qcm', options: ['a', 'b'], bonneReponse: 0 }])
    const numero = screen.getByLabelText(/Numéro de la bonne réponse/)
    expect(numero).toHaveValue(1)

    // fireEvent plutôt que userEvent : le champ est contrôlé et ne retient pas
    // la frappe précédente, ce qui rendrait « 2 » après un vidage illisible.
    fireEvent.change(numero, { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith([{ type: 'qcm', options: ['a', 'b'], bonneReponse: 1 }])
  })

  it('découpe les options du QCM, une par ligne', async () => {
    const { onChange } = monter([{ type: 'qcm', options: [''], bonneReponse: 0 }])
    await userEvent.type(screen.getByLabelText(/Options/), 'a')
    expect(onChange).toHaveBeenCalledWith([{ type: 'qcm', options: ['a'], bonneReponse: 0 }])
  })

  it('remonte le motif', async () => {
    const { onChange } = monter([{ type: 'interdit', motif: '' }])
    await userEvent.type(screen.getByLabelText('Motif'), 'x')
    expect(onChange).toHaveBeenCalledWith([{ type: 'interdit', motif: 'x' }])
  })

  it('remonte le message, et l efface quand on le vide', async () => {
    const { onChange } = monter([{ type: 'interdit', motif: 'x', message: 'y' }])
    const message = screen.getByLabelText(/Message pour l/)
    await userEvent.type(message, 'z')
    expect(onChange).toHaveBeenCalledWith([{ type: 'interdit', motif: 'x', message: 'yz' }])

    await userEvent.clear(message)
    expect(onChange).toHaveBeenCalledWith([{ type: 'interdit', motif: 'x', message: undefined }])
  })

  it('bascule la maîtrise d un contient', async () => {
    const { onChange } = monter([{ type: 'contient', motif: 'for' }])
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith([{ type: 'contient', motif: 'for', maitrise: true }])
  })
})

describe('Tests — ce que les cartes disent à l auteur', () => {
  it('avertit qu un motif ne doit pas porter de guillemets', () => {
    monter([{ type: 'interdit', motif: 'x' }])
    expect(screen.getByText(/se contourne en changeant de guillemets/)).toBeInTheDocument()
  })

  it('nomme la sorte de chaque carte', () => {
    monter([{ type: 'qcm', options: ['a'], bonneReponse: 0 }])
    const carte = screen.getByRole('listitem')
    expect(within(carte).getByText('QCM')).toBeInTheDocument()
  })
})

describe('Tests — modifier une carte laisse les autres tranquilles', () => {
  it('ne touche que celle qu on édite', async () => {
    const { onChange } = monter([
      { type: 'interdit', motif: 'premier' },
      { type: 'interdit', motif: 'second' },
    ])
    await userEvent.type(screen.getAllByLabelText('Motif')[1]!, 'X')

    expect(onChange).toHaveBeenCalledWith([
      { type: 'interdit', motif: 'premier' },
      { type: 'interdit', motif: 'secondX' },
    ])
  })
})

import { EditorView } from '@codemirror/view'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BROUILLON_VIDE, type Brouillon } from '../../../src/atelier/brouillon'
import type { SchemaPublie } from '../../../src/atelier/schema'
import type { Notion } from '../../../src/contenu/types'
import { Formulaire } from '../../../src/ui/atelier/Formulaire'

const NOTIONS: Notion[] = [
  { id: 'afficher', ordre: 1, titre: 'Afficher un message', famille: 'conditions', chapitre: 'bases' },
  { id: 'comparer', ordre: 7, titre: 'Comparer', famille: 'types', chapitre: 'decisions' },
]

const SCHEMA: SchemaPublie = {
  exercice: {
    properties: {
      type: { enum: ['predire', 'debug', 'completer', 'ecrire'] },
      niveau: { enum: ['normal', 'expert'] },
    },
  },
  lecon: {},
}

function monter(brouillon: Partial<Brouillon> = {}) {
  const onChange = vi.fn()
  render(
    <Formulaire
      brouillon={{ ...BROUILLON_VIDE, ...brouillon }}
      notions={NOTIONS}
      schema={SCHEMA}
      onChange={onChange}
    />,
  )
  return onChange
}

describe('Formulaire — ce qui vient du contenu publié', () => {
  it('liste les notions telles que notions.json les donne', () => {
    monter()
    expect(screen.getByRole('option', { name: 'Afficher un message' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Comparer' })).toBeInTheDocument()
  })

  it("tire les types et les niveaux du schéma, dans son ordre", () => {
    // L'ordre est pédagogique, pas alphabétique : le recopier ici le perdrait.
    monter()
    const types = screen.getByLabelText('Type')
    expect([...types.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'predire',
      'debug',
      'completer',
      'ecrire',
    ])
  })
})

describe('Formulaire — la séance se déduit, elle ne se saisit pas', () => {
  it("n'affiche aucune séance tant que l'identifiant n'est pas formé", () => {
    monter({ id: 'brouillon' })
    expect(screen.getByText(/Forme attendue/)).toBeInTheDocument()
  })

  it("annonce la séance dès que l'identifiant la donne", () => {
    monter({ id: 's4-12' })
    expect(screen.getByText("Séance 4, déduite de l'identifiant.")).toBeInTheDocument()
  })

  it("met la séance d'accord avec l'identifiant à chaque frappe", async () => {
    // s2-14 avec seance 3 n'échoue nulle part : l'exercice apparaît le mauvais
    // jour. Autant ne jamais produire le désaccord.
    const onChange = monter({ id: 's4-1', seance: 1 })
    await userEvent.type(screen.getByLabelText('Identifiant'), '2')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 's4-12', seance: 4 }))
  })

  it("garde la dernière séance connue quand l'identifiant redevient incomplet", async () => {
    const onChange = monter({ id: 's4-12', seance: 4 })
    await userEvent.clear(screen.getByLabelText('Identifiant'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: '', seance: 4 }))
  })
})

describe('Formulaire — les champs', () => {
  it('remonte le titre saisi', async () => {
    const onChange = monter()
    await userEvent.type(screen.getByLabelText('Titre'), 'X')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ titre: 'X' }))
  })

  it('remonte la notion choisie', async () => {
    const onChange = monter()
    await userEvent.selectOptions(screen.getByLabelText('Notion'), 'comparer')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notion: 'comparer' }))
  })

  it('remonte le concept, le type et le niveau', async () => {
    const onChange = monter()
    await userEvent.type(screen.getByLabelText('Concept'), 'b')
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'debug')
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'expert')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ concept: 'b' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'debug' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ niveau: 'expert' }))
  })

  it("bascule l'obligatoire", async () => {
    const onChange = monter({ obligatoire: true })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ obligatoire: false }))
  })

  it("remonte l'énoncé", async () => {
    const onChange = monter()
    await userEvent.type(screen.getByLabelText('Énoncé'), 'A')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enonce: 'A' }))
  })
})

describe('Formulaire — les indices sont du texte brut', () => {
  it('le dit, parce que le double astérisque y reste littéral', () => {
    monter()
    expect(screen.getByText(/texte brut/)).toBeInTheDocument()
  })

  it('découpe une ligne par indice', async () => {
    const onChange = monter()
    // Une frappe, un appel : le composant est contrôlé, et sa valeur repart
    // de la prop tant que le parent ne l'a pas remontée.
    await userEvent.type(screen.getByLabelText('Indices, un par ligne'), 'u')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ indices: ['u'] }))
  })

  it('rend une liste vide plutôt qu une ligne vide', async () => {
    const onChange = monter({ indices: ['un'] })
    await userEvent.clear(screen.getByLabelText('Indices, un par ligne'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ indices: [] }))
  })
})

describe('Formulaire — les deux éditeurs de code', () => {
  it("emploie l'éditeur de l'élève pour le départ et la solution", () => {
    // Le même composant, donc la même indentation à quatre espaces et le même
    // Tab : ce qu'on écrit ici est ce que l'élève recevra.
    const { container } = render(
      <Formulaire
        brouillon={{ ...BROUILLON_VIDE, depart: 'a = 1', solution: 'b = 2' }}
        notions={NOTIONS}
        schema={SCHEMA}
        onChange={vi.fn()}
      />,
    )
    expect(container.querySelectorAll('.editeur')).toHaveLength(2)
  })

  it.each([
    [0, 'depart'],
    [1, 'solution'],
  ])("remonte ce qu'on tape dans l'éditeur %i", async (rang, champ) => {
    const onChange = vi.fn()
    const { container } = render(
      <Formulaire
        brouillon={{ ...BROUILLON_VIDE, depart: 'a = 1', solution: 'b = 2' }}
        notions={NOTIONS}
        schema={SCHEMA}
        onChange={onChange}
      />,
    )
    const cadres = container.querySelectorAll('.cm-editor')
    const vue = EditorView.findFromDOM(cadres[rang] as HTMLElement)!
    vue.dispatch({ changes: { from: 0, insert: 'x' } })

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ [champ]: expect.stringContaining('x') }))
  })

  it("dit que la solution n'est jamais publiée", () => {
    monter()
    expect(screen.getByText(/jamais publiée/)).toBeInTheDocument()
  })
})

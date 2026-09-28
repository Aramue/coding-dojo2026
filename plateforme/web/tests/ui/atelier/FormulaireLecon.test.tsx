import { EditorView } from '@codemirror/view'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LECON_VIDE, type BrouillonLecon } from '../../../src/atelier/lecon'
import type { Notion } from '../../../src/contenu/types'
import { FormulaireLecon } from '../../../src/ui/atelier/FormulaireLecon'

const NOTIONS: Notion[] = [
  { id: 'afficher', ordre: 1, titre: 'Afficher', famille: 'conditions', chapitre: 'bases' },
  { id: 'comparer', ordre: 7, titre: 'Comparer', famille: 'types', chapitre: 'decisions' },
]

function monter(brouillon: Partial<BrouillonLecon> = {}) {
  const onChange = vi.fn()
  const rendu = render(
    <FormulaireLecon
      brouillon={{ ...LECON_VIDE, ...brouillon }}
      notions={NOTIONS}
      onChange={onChange}
    />,
  )
  return { onChange, ...rendu }
}

describe("FormulaireLecon — l'ordre se déduit, il ne se saisit pas", () => {
  it("attend un identifiant tant que la notion n'est pas choisie", () => {
    monter()
    expect(screen.getByText('Forme attendue : c2-comparer.')).toBeInTheDocument()
  })

  it("annonce l'ordre de la notion dès qu'elle est choisie", () => {
    // Le schéma refuse le désaccord : autant ne jamais le produire.
    monter({ notion: 'comparer' })
    expect(screen.getByText('Ordre 7, celui de sa notion.')).toBeInTheDocument()
  })
})

describe('FormulaireLecon — les champs', () => {
  it('remonte identifiant, titre, notion et durée', async () => {
    const { onChange } = monter()
    await userEvent.type(screen.getByLabelText('Identifiant'), 'c')
    await userEvent.type(screen.getByLabelText('Titre'), 'T')
    await userEvent.selectOptions(screen.getByLabelText('Notion'), 'comparer')
    fireEvent.change(screen.getByLabelText(/Durée de lecture/), { target: { value: '8' } })

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ titre: 'T' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notion: 'comparer' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dureeMin: 8 }))
  })
})

describe('FormulaireLecon — les blocs', () => {
  it.each([
    ['Paragraphe', { type: 'paragraphe', texte: '' }],
    ['Attention', { type: 'attention', texte: '' }],
    ['Code', { type: 'code', legende: '', python: '', executable: false, entrees: [] }],
  ])('ajoute un bloc %s', async (libelle, attendu) => {
    const { onChange } = monter()
    await userEvent.click(screen.getByRole('button', { name: `+ ${libelle}` }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ blocs: [attendu] }))
  })

  it('retire le bloc visé, et lui seul', async () => {
    const { onChange } = monter({
      blocs: [
        { type: 'paragraphe', texte: 'un' },
        { type: 'paragraphe', texte: 'deux' },
      ],
    })
    await userEvent.click(screen.getAllByRole('button', { name: 'Retirer' })[0]!)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ blocs: [{ type: 'paragraphe', texte: 'deux' }] }),
    )
  })

  it('remonte le texte d un paragraphe, sans toucher aux autres blocs', async () => {
    const { onChange } = monter({
      blocs: [
        { type: 'paragraphe', texte: 'un' },
        { type: 'attention', texte: 'deux' },
      ],
    })
    await userEvent.type(screen.getAllByLabelText('Texte')[1]!, 'X')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        blocs: [
          { type: 'paragraphe', texte: 'un' },
          { type: 'attention', texte: 'deuxX' },
        ],
      }),
    )
  })

  it('remonte la légende et le code d un bloc de code', async () => {
    const { onChange, container } = monter({
      blocs: [{ type: 'code', legende: 'L', python: 'x = 1', executable: false, entrees: [] }],
    })
    await userEvent.type(screen.getByLabelText('Légende'), 'X')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ blocs: [expect.objectContaining({ legende: 'LX' })] }),
    )

    const vue = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    vue.dispatch({ changes: { from: 0, insert: 'y' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        blocs: [expect.objectContaining({ python: expect.stringContaining('y') })],
      }),
    )
  })
})

describe('FormulaireLecon — entrées et exécutable sont incompatibles', () => {
  const CODE: BrouillonLecon['blocs'] = [
    { type: 'code', legende: 'L', python: 'x = 1', executable: true, entrees: [] },
  ]

  it('le dit à l auteur', () => {
    monter({ blocs: CODE })
    expect(screen.getByText(/ne sait pas les fournir/)).toBeInTheDocument()
  })

  it("retire l'exécutable dès qu'on saisit une entrée", async () => {
    // Le bac à sable ne sait pas fournir d'entrées : l'élève tomberait sur
    // une EOFError en cliquant « Essayer ».
    const { onChange } = monter({ blocs: CODE })
    await userEvent.type(screen.getByLabelText(/Entrées simulées/), 'a')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        blocs: [expect.objectContaining({ entrees: ['a'], executable: false })],
      }),
    )
  })

  it("interdit de cocher exécutable tant qu'il y a des entrées", () => {
    monter({
      blocs: [
        { type: 'code', legende: 'L', python: 'input()', executable: false, entrees: ['a'] },
      ],
    })
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('laisse cocher exécutable sans entrées', async () => {
    const { onChange } = monter({
      blocs: [{ type: 'code', legende: 'L', python: 'x = 1', executable: false, entrees: [] }],
    })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ blocs: [expect.objectContaining({ executable: true })] }),
    )
  })

  it('rend une liste vide plutôt qu une entrée vide', async () => {
    const { onChange } = monter({
      blocs: [
        { type: 'code', legende: 'L', python: 'input()', executable: false, entrees: ['a'] },
      ],
    })
    await userEvent.clear(screen.getByLabelText(/Entrées simulées/))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ blocs: [expect.objectContaining({ entrees: [] })] }),
    )
  })
})

describe('FormulaireLecon — réordonner les blocs', () => {
  const TROIS: BrouillonLecon['blocs'] = [
    { type: 'paragraphe', texte: 'un' },
    { type: 'paragraphe', texte: 'deux' },
    { type: 'paragraphe', texte: 'trois' },
  ]

  it('monte un bloc', async () => {
    const { onChange } = monter({ blocs: TROIS })
    await userEvent.click(screen.getByRole('button', { name: 'Monter le bloc 2' }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        blocs: [TROIS[1], TROIS[0], TROIS[2]],
      }),
    )
  })

  it('descend un bloc', async () => {
    const { onChange } = monter({ blocs: TROIS })
    await userEvent.click(screen.getByRole('button', { name: 'Descendre le bloc 1' }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        blocs: [TROIS[1], TROIS[0], TROIS[2]],
      }),
    )
  })

  it("ne laisse pas monter le premier ni descendre le dernier", () => {
    monter({ blocs: TROIS })
    expect(screen.getByRole('button', { name: 'Monter le bloc 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descendre le bloc 3' })).toBeDisabled()
  })
})

import { render } from '@testing-library/react'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { Editeur } from '../../src/ui/Editeur'

function monter(valeur: string) {
  const onChange = vi.fn()
  const { container } = render(<Editeur valeur={valeur} onChange={onChange} />)
  const vue = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)
  if (!vue) throw new Error("L'éditeur n'est pas monté")
  return { vue, onChange }
}

const touche = (key: string, shiftKey = false) =>
  new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })

describe('Editeur — le clavier du débutant', () => {
  it("indente de quatre espaces sur Tab, au lieu d'envoyer le focus ailleurs", () => {
    // Sans cette touche, l'eleve qui decalait le corps d'un if envoyait le
    // focus sur le bouton Valider, et son code ne bougeait pas.
    const { vue, onChange } = monter('if pluie:\nprint("Parapluie")')
    vue.dispatch({ selection: { anchor: vue.state.doc.line(2).from } })

    expect(runScopeHandlers(vue, touche('Tab'), 'editor')).toBe(true)
    expect(vue.state.doc.line(2).text).toBe('    print("Parapluie")')
    expect(onChange).toHaveBeenLastCalledWith('if pluie:\n    print("Parapluie")')
  })

  it('désindente sur Maj+Tab', () => {
    const { vue } = monter('if pluie:\n    print("Parapluie")')
    vue.dispatch({ selection: { anchor: vue.state.doc.line(2).to } })

    expect(runScopeHandlers(vue, touche('Tab', true), 'editor')).toBe(true)
    expect(vue.state.doc.line(2).text).toBe('print("Parapluie")')
  })

  it('décale de quatre espaces la ligne qui suit un deux-points', () => {
    // Le meme decalage que Tab : un bloc tape a la main et un bloc indente au
    // clavier doivent s'aligner, sinon Python leve une IndentationError.
    const { vue } = monter('if pluie:')
    vue.dispatch({ selection: { anchor: vue.state.doc.length } })

    runScopeHandlers(vue, touche('Enter'), 'editor')
    expect(vue.state.doc.toString()).toBe('if pluie:\n    ')
  })
})

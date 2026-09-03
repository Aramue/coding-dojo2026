import { python } from '@codemirror/lang-python'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { useEffect, useRef } from 'react'

export function Editeur({
  valeur,
  onChange,
  lectureSeule = false,
}: {
  valeur: string
  onChange: (v: string) => void
  lectureSeule?: boolean
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const vue = useRef<EditorView | null>(null)
  const rappel = useRef(onChange)
  rappel.current = onChange

  useEffect(() => {
    if (!conteneur.current) return
    const etat = EditorState.create({
      doc: valeur,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        python(),
        oneDark,
        EditorView.editable.of(!lectureSeule),
        EditorView.updateListener.of((maj) => {
          if (maj.docChanged) rappel.current(maj.state.doc.toString())
        }),
        EditorView.theme({
          '&': { fontFamily: 'var(--police-code)', fontSize: '0.88rem', borderRadius: '12px' },
          '.cm-content': { padding: '0.9rem 0' },
          '&.cm-focused': { outline: '3px solid var(--py-yellow)' },
        }),
      ],
    })
    vue.current = new EditorView({ state: etat, parent: conteneur.current })
    return () => vue.current?.destroy()
    // Volontairement monté une seule fois : le contenu est piloté par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureSeule])

  // Remise à l'état de départ quand on change d'exercice.
  useEffect(() => {
    const v = vue.current
    if (!v || v.state.doc.toString() === valeur) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: valeur } })
  }, [valeur])

  return <div ref={conteneur} className="editeur" aria-label="Éditeur de code Python" />
}

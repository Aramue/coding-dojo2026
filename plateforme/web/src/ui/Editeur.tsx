import { python } from '@codemirror/lang-python'
import { Compartment, EditorState } from '@codemirror/state'
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

  // Compartiments : ils permettent de reconfigurer l'éditeur sans le détruire.
  // Sans eux, basculer `lectureSeule` recrée la vue et l'élève perd son
  // historique d'annulation, son curseur, son défilement et son focus.
  const compartimentEditable = useRef(new Compartment())
  const compartimentHistorique = useRef(new Compartment())

  useEffect(() => {
    if (!conteneur.current) return
    const etat = EditorState.create({
      doc: valeur,
      extensions: [
        lineNumbers(),
        compartimentHistorique.current.of(history()),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        python(),
        oneDark,
        compartimentEditable.current.of(EditorView.editable.of(!lectureSeule)),
        EditorView.updateListener.of((maj) => {
          if (maj.docChanged) rappel.current(maj.state.doc.toString())
        }),
        EditorView.theme({
          '&': { fontFamily: 'var(--police-code)', fontSize: '0.88rem', borderRadius: '12px' },
          // Une zone d'écriture, pas un champ de formulaire. Sur un exercice
          // qui démarre à vide, l'éditeur mesurait une ligne : sous un énoncé
          // en pleine largeur, il ne se lisait plus comme l'endroit où agir.
          '.cm-scroller': { minHeight: '9rem' },
          '.cm-content': { padding: '0.9rem 0' },
          '&.cm-focused': { outline: '3px solid var(--py-yellow)' },
        }),
      ],
    })
    vue.current = new EditorView({ state: etat, parent: conteneur.current })
    return () => vue.current?.destroy()
    // Monté une seule fois, réellement : `lectureSeule` et `valeur` sont pilotés
    // par les deux effets suivants, sans jamais recréer la vue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bascule lecture/écriture sans détruire la vue.
  useEffect(() => {
    vue.current?.dispatch({
      effects: compartimentEditable.current.reconfigure(EditorView.editable.of(!lectureSeule)),
    })
  }, [lectureSeule])

  // Changement d'exercice : on remplace le document et on vide l'historique.
  // Sans ce vidage, Ctrl+Z ramènerait le code de l'exercice précédent.
  useEffect(() => {
    const v = vue.current
    if (!v || v.state.doc.toString() === valeur) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: valeur } })
    v.dispatch({ effects: compartimentHistorique.current.reconfigure([]) })
    v.dispatch({ effects: compartimentHistorique.current.reconfigure(history()) })
  }, [valeur])

  return <div ref={conteneur} className="editeur" aria-label="Éditeur de code Python" />
}

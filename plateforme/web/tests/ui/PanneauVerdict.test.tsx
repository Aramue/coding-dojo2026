import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanneauVerdict } from '../../src/ui/PanneauVerdict'

describe('PanneauVerdict', () => {
  it('n affiche rien tant qu il n y a pas de resultat', () => {
    const { container } = render(<PanneauVerdict resultat={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche le succes en vert', () => {
    render(<PanneauVerdict resultat={{ verdict: 'vert', titre: "C'est juste." }} />)
    expect(screen.getByRole('status')).toHaveClass('verdict--vert')
    expect(screen.getByText("C'est juste.")).toBeInTheDocument()
  })

  it('affiche le bleu et son diff', () => {
    render(
      <PanneauVerdict
        resultat={{
          verdict: 'bleu',
          titre: 'Ta logique est correcte, le format est à ajuster.',
          diff: [
            { type: 'egal', texte: 'Bonjour·' },
            { type: 'ajout', texte: '·' },
            { type: 'egal', texte: 'Camille' },
          ],
        }}
      />,
    )
    expect(screen.getByRole('status')).toHaveClass('verdict--bleu')
    expect(screen.getByTestId('diff')).toBeInTheDocument()
    expect(screen.getAllByTestId('diff-ajout')).toHaveLength(1)
  })

  it('affiche l echec et son detail', () => {
    render(
      <PanneauVerdict
        resultat={{
          verdict: 'rouge',
          titre: "La variable age devrait contenir un nombre entier, pas du texte.",
          detail: 'Tu as écrit \'17\' avec des guillemets.',
        }}
      />,
    )
    expect(screen.getByRole('status')).toHaveClass('verdict--rouge')
    expect(screen.getByText(/guillemets/)).toBeInTheDocument()
  })

  it('annonce le resultat aux lecteurs d ecran', () => {
    render(<PanneauVerdict resultat={{ verdict: 'vert', titre: "C'est juste." }} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})

describe('PanneauVerdict — les deux sorties, chacune sur sa ligne', () => {
  const PROCHE = [
    { type: 'egal', texte: 'Bonjour·' },
    { type: 'manque', texte: 'C' },
    { type: 'ajout', texte: 'c' },
    { type: 'egal', texte: 'amille' },
  ] as const

  function rendre(diff: readonly { type: string; texte: string }[]) {
    return render(
      <PanneauVerdict
        resultat={{
          verdict: 'rouge',
          titre: "Ton programme n'affiche pas ce qui est attendu.",
          diff: diff as never,
        }}
      />,
    )
  }

  it('nomme laquelle est laquelle', () => {
    rendre(PROCHE)
    expect(screen.getByText('Attendu')).toBeInTheDocument()
    expect(screen.getByText('Obtenu')).toBeInTheDocument()
  })

  it('reconstitue chaque sortie en entier, sans la chaine hybride', () => {
    const { container } = rendre(PROCHE)
    const lignes = [...container.querySelectorAll('.comparaison__texte')]
    expect(lignes.map((l) => l.textContent)).toEqual(['Bonjour·Camille', 'Bonjour·camille'])
  })

  it('ne met le manquant que sur la ligne attendue, et l en-trop que sur l autre', () => {
    const { container } = rendre(PROCHE)
    const [attendu, obtenu] = container.querySelectorAll('.comparaison__texte')
    expect(attendu!.querySelectorAll('.diff--manque')).toHaveLength(1)
    expect(attendu!.querySelectorAll('.diff--ajout')).toHaveLength(0)
    expect(obtenu!.querySelectorAll('.diff--ajout')).toHaveLength(1)
    expect(obtenu!.querySelectorAll('.diff--manque')).toHaveLength(0)
  })

  it('renonce a surligner deux sorties qui n ont rien a voir', () => {
    // Sans ce garde-fou, « banane » face a « Bonjour tout le monde » se
    // decoupait en confettis illisibles.
    const { container } = rendre([
      { type: 'manque', texte: 'Bo' },
      { type: 'ajout', texte: 'ba' },
      { type: 'egal', texte: 'n' },
      { type: 'manque', texte: 'jour·tout·le·mo' },
      { type: 'ajout', texte: 'a' },
      { type: 'egal', texte: 'n' },
      { type: 'manque', texte: 'd' },
      { type: 'egal', texte: 'e' },
    ])
    expect(container.querySelectorAll('mark')).toHaveLength(0)
    const lignes = [...container.querySelectorAll('.comparaison__texte')]
    expect(lignes.map((l) => l.textContent)).toEqual(['Bonjour·tout·le·monde', 'banane'])
  })
})

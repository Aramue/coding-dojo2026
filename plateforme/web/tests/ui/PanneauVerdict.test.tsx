import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanneauVerdict } from '../../src/ui/PanneauVerdict'

describe('PanneauVerdict', () => {
  it('n affiche rien tant qu il n y a pas de resultat', () => {
    const { container } = render(<PanneauVerdict resultat={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche le succes en vert', () => {
    render(<PanneauVerdict resultat={{ verdict: 'vert', titre: 'Mission accomplie.' }} />)
    expect(screen.getByRole('status')).toHaveClass('verdict--vert')
    expect(screen.getByText('Mission accomplie.')).toBeInTheDocument()
  })

  it('affiche le bleu et son diff', () => {
    render(
      <PanneauVerdict
        resultat={{
          verdict: 'bleu',
          titre: 'Ta logique est correcte, le format est à ajuster.',
          diff: [
            { type: 'egal', texte: 'Agent·' },
            { type: 'ajout', texte: '·' },
            { type: 'egal', texte: 'Corbeau' },
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
    render(<PanneauVerdict resultat={{ verdict: 'vert', titre: 'Mission accomplie.' }} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})

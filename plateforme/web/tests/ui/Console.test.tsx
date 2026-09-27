import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Console } from '../../src/ui/Console'

describe('Console — ce qu elle dit quand il n y a rien', () => {
  it('annonce le demarrage pendant l execution', () => {
    render(<Console passages={[]} enCours />)
    expect(screen.getByText('Ton programme démarre…')).toBeInTheDocument()
    expect(screen.getByText('en cours')).toBeInTheDocument()
  })

  it('invite a valider quand rien ne tourne', () => {
    render(<Console passages={[]} enCours={false} />)
    expect(screen.getByText("Rien pour l'instant. Valide pour l'exécuter.")).toBeInTheDocument()
    expect(screen.getByText('sortie de ton programme')).toBeInTheDocument()
  })
})

describe('Console — plusieurs essais', () => {
  it("n annonce pas les essais tant qu il n y en a qu un", () => {
    render(<Console passages={[{ entrees: ['Camille'], texte: 'Bonjour Camille' }]} enCours={false} />)
    expect(screen.queryByText(/Essai avec/)).toBeNull()
    expect(screen.getByText('Bonjour Camille')).toBeInTheDocument()
  })

  it('nomme chaque essai des qu il y en a deux', () => {
    // Un exercice à plusieurs jeux d'entrées affiche une console par jeu :
    // sans l'étiquette, l'élève ne sait pas laquelle a échoué.
    render(
      <Console
        passages={[
          { entrees: ['Camille'], texte: 'Bonjour Camille' },
          { entrees: [], texte: 'Bonjour' },
        ]}
        enCours={false}
      />,
    )
    expect(screen.getByText('Essai avec Camille')).toBeInTheDocument()
    expect(screen.getByText('Essai sans réponse à saisir')).toBeInTheDocument()
  })

  it("dit qu un passage n a rien affiche, plutot que de laisser un vide", () => {
    render(<Console passages={[{ entrees: [], texte: '' }]} enCours={false} />)
    expect(screen.getByText("Ce passage n'a rien affiché.")).toBeInTheDocument()
  })

  it('remplace le vide par des points de suspension pendant l execution', () => {
    render(<Console passages={[{ entrees: [], texte: '' }]} enCours />)
    expect(screen.getByText('…')).toBeInTheDocument()
  })
})

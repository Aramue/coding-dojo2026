import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EcranConnexion } from '../../src/ui/EcranConnexion'

describe('EcranConnexion', () => {
  it("refuse d'envoyer un code trop court", () => {
    render(<EcranConnexion onConnecte={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeDisabled()
  })

  it('met le code en capitales et le debarrasse des espaces', async () => {
    const connecter = vi.fn(async () => {})
    render(<EcranConnexion onConnecte={connecter} />)
    await userEvent.type(screen.getByLabelText("Code d'accès"), '  dojo-k7m2  ')
    await userEvent.click(screen.getByRole('button', { name: 'Commencer' }))
    expect(connecter).toHaveBeenCalledWith('DOJO-K7M2')
  })

  it("affiche l'erreur renvoyee, et la relie au champ", async () => {
    render(
      <EcranConnexion
        onConnecte={vi.fn(async () => {
          throw new Error('Code inconnu.')
        })}
      />,
    )
    await userEvent.type(screen.getByLabelText("Code d'accès"), 'DOJO-XXXX')
    await userEvent.click(screen.getByRole('button', { name: 'Commencer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Code inconnu.')
    expect(screen.getByLabelText("Code d'accès")).toHaveAttribute(
      'aria-describedby',
      'erreur-connexion',
    )
  })

  it('propose un exemple de code au bon format', () => {
    render(<EcranConnexion onConnecte={vi.fn()} />)
    expect(screen.getByLabelText("Code d'accès")).toHaveAttribute('placeholder', 'DOJO-K7M2')
  })

  it('ne parle ni d agent ni de mission', () => {
    const { container } = render(<EcranConnexion onConnecte={vi.fn()} />)
    expect(container.textContent).not.toMatch(/agent|mission|quartier/i)
  })
})

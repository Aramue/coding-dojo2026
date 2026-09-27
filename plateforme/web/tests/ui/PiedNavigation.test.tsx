import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PiedNavigation } from '../../src/ui/PiedNavigation'

const PRECEDENT = { cible: { vue: 'cours', notion: 'variables' } as const, libelle: 'Le cours' }
const SUIVANT = {
  cible: { vue: 'exercice', notion: 'variables', numero: 2 } as const,
  libelle: 'Exercice 2',
}

beforeEach(() => history.pushState(null, '', '/depart'))

describe('PiedNavigation', () => {
  it("ne s'affiche pas quand il n'y a nulle part où aller", () => {
    const { container } = render(<PiedNavigation />)
    expect(container.firstChild).toBeNull()
  })

  it('garde la place du précédent quand il manque, pour que le suivant reste à droite', () => {
    const { container } = render(<PiedNavigation suivant={SUIVANT} />)
    expect(container.querySelector('nav')?.children).toHaveLength(2)
  })

  it('navigue sans recharger, et remonte en haut de la page', async () => {
    // Sans la remontée, l'élève arrive au milieu du texte suivant, à la
    // hauteur où il avait laissé le précédent.
    const remonter = vi.fn()
    vi.stubGlobal('scrollTo', remonter)
    render(<PiedNavigation precedent={PRECEDENT} suivant={SUIVANT} />)

    await userEvent.click(screen.getByRole('link', { name: /Exercice 2/ }))

    expect(location.pathname).toBe('/variables/exercices/2')
    expect(remonter).toHaveBeenCalledWith({ top: 0 })
    vi.unstubAllGlobals()
  })

  it("laisse Ctrl+clic ouvrir un onglet, comme n'importe quel lien", () => {
    render(<PiedNavigation precedent={PRECEDENT} suivant={SUIVANT} />)
    fireEvent.click(screen.getByRole('link', { name: /Le cours/ }), { ctrlKey: true })
    expect(location.pathname).toBe('/depart')
  })

  it("se met en sombre sur l'écran d'exercice", () => {
    const { container } = render(<PiedNavigation suivant={SUIVANT} sombre />)
    expect(container.querySelector('nav')?.className).toContain('pied--sombre')
  })
})

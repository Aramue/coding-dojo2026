import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Terminal, genreLigne } from '../../src/ui/Terminal'

describe('genreLigne', () => {
  it.each([
    ['$ git status', 'commande'],
    ['# un commentaire', 'commentaire'],
    ['@@ -1,2 +1,2 @@', 'commentaire'],
    ['+    return round(x, 1)', 'plus'],
    ['-    return x', 'moins'],
    [' ! [rejected]        main -> main', 'texte'],
    ['! [rejected] main -> main', 'erreur'],
    ['error: failed to push some refs', 'erreur'],
    ['<<<<<<< HEAD', 'marqueur'],
    ['=======', 'marqueur'],
    ['>>>>>>> ma-fonction', 'marqueur'],
    ['On branch main', 'texte'],
  ])('classe « %s » comme %s', (ligne, genre) => {
    expect(genreLigne(ligne)).toBe(genre)
  })
})

describe('Terminal', () => {
  it("affiche la légende, l'invite à part et les lignes colorées", () => {
    const { container, getByText } = render(
      <Terminal legende="Le terminal" texte={'$ git diff\n-ancien\n+nouveau'} />,
    )
    expect(getByText('Le terminal')).toBeInTheDocument()
    expect(container.querySelector('.terminal__invite')?.textContent).toBe('$ ')
    expect(container.querySelector('.terminal__ligne--commande')?.textContent).toContain('git diff')
    expect(container.querySelector('.terminal__ligne--moins')?.textContent).toContain('ancien')
    expect(container.querySelector('.terminal__ligne--plus')?.textContent).toContain('nouveau')
  })
})

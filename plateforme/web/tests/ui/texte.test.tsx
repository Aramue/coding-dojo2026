import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formaterTexte } from '../../src/ui/texte'

function rendre(texte: string) {
  return render(<p data-testid="p">{formaterTexte(texte)}</p>)
}

describe('formaterTexte', () => {
  it('laisse un texte simple intact', () => {
    rendre('Une variable est une boîte.')
    expect(screen.getByTestId('p')).toHaveTextContent('Une variable est une boîte.')
  })

  it('met en gras entre doubles etoiles', () => {
    const { container } = rendre('Une **boîte** nommée.')
    expect(container.querySelector('strong')).toHaveTextContent('boîte')
    expect(screen.getByTestId('p')).toHaveTextContent('Une boîte nommée.')
  })

  it('met en chasse fixe entre accents graves', () => {
    const { container } = rendre('Le signe `=` range une valeur.')
    expect(container.querySelector('code')).toHaveTextContent('=')
  })

  it('gere plusieurs marques dans le meme texte', () => {
    const { container } = rendre('**Range** avec `=` puis **relis**.')
    expect(container.querySelectorAll('strong')).toHaveLength(2)
    expect(container.querySelectorAll('code')).toHaveLength(1)
  })

  it('laisse une etoile isolee telle quelle', () => {
    rendre('2 * 3 vaut 6.')
    expect(screen.getByTestId('p')).toHaveTextContent('2 * 3 vaut 6.')
  })

  it('laisse un accent grave isole tel quel', () => {
    const { container } = rendre('Un accent ` tout seul.')
    expect(container.querySelector('code')).toBeNull()
    expect(screen.getByTestId('p')).toHaveTextContent('Un accent ` tout seul.')
  })

  it('ne rend jamais de balise HTML fournie dans le texte', () => {
    // Le contenu vient de nos propres fichiers YAML, mais on n'injecte jamais
    // de HTML : une balise ecrite dans une lecon s'affiche, elle ne s'execute pas.
    const { container } = rendre('<script>alert(1)</script> et **gras**')
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByTestId('p')).toHaveTextContent('<script>alert(1)</script> et gras')
  })

  it('gere un texte vide', () => {
    rendre('')
    expect(screen.getByTestId('p')).toBeEmptyDOMElement()
  })

  it('gere une marque en tout debut et en toute fin', () => {
    const { container } = rendre('**Attention** au `=`')
    expect(container.querySelector('strong')).toHaveTextContent('Attention')
    expect(container.querySelector('code')).toHaveTextContent('=')
  })
})

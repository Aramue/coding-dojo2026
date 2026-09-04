import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { decouperEnonce, formaterTexte, genreDuBloc } from '../../src/ui/texte'

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

describe('decouperEnonce', () => {
  it('separe les paragraphes sur les lignes vides', () => {
    const blocs = decouperEnonce('Premier.\n\nDeuxième.')
    expect(blocs.map((b) => b.texte)).toEqual(['Premier.', 'Deuxième.'])
  })

  it('reenroule une phrase coupee par la mise en page du fichier', () => {
    // Le defaut visible : le YAML coupe vers 75 colonnes, ce qui n'a aucun
    // rapport avec la largeur de l'ecran de l'eleve.
    const blocs = decouperEnonce(
      "Une variable, c'est une boîte avec une étiquette. L'étiquette est le nom\nde la boîte. À l'intérieur, il y a une valeur.",
    )
    expect(blocs).toHaveLength(1)
    expect(blocs[0]!.genre).toBe('paragraphe')
    expect(blocs[0]!.texte).not.toContain('\n')
  })

  it('reconnait une sortie attendue et garde ses retours', () => {
    const blocs = decouperEnonce('=== CARTE ===\nNom : Camille\nAge : 17 ans')
    expect(blocs[0]!.genre).toBe('sortie')
    expect(blocs[0]!.texte).toContain('\n')
  })

  it('reconnait une liste de consignes, meme avec des lignes longues', () => {
    const blocs = decouperEnonce(
      'Il doit faire deux choses :\n1. demander le prénom, avec une invite précise et complète ;\n2. demander son âge et le convertir en nombre entier avant tout calcul ;',
    )
    expect(blocs[0]!.genre).toBe('liste')
    expect(blocs[0]!.texte).toContain('\n')
  })

  it("une liste n'est pas de la chasse fixe, une sortie l'est", () => {
    expect(genreDuBloc('1. un\n2. deux')).toBe('liste')
    expect(genreDuBloc('- un\n- deux')).toBe('liste')
    expect(genreDuBloc('a = 1\nb = 2')).toBe('sortie')
  })

  it('ne prend pas une ligne unique pour un bloc a retours signifiants', () => {
    expect(genreDuBloc('Bonjour')).toBe('paragraphe')
    expect(genreDuBloc('=== CARTE ===')).toBe('paragraphe')
  })

  it('ignore les lignes vides en trop', () => {
    expect(decouperEnonce('\n\nUn.\n\n\n\nDeux.\n\n')).toHaveLength(2)
  })

  it('coupe aussi sur une ligne qui ne contient que des espaces', () => {
    expect(decouperEnonce('Un.\n   \nDeux.')).toHaveLength(2)
  })
})

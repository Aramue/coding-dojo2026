import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SCHEMAS, SchemaTp } from '../../src/ui/SchemaTp'

describe('SchemaTp', () => {
  it.each(SCHEMAS)('dessine le schéma « %s », décrit pour un lecteur d écran', (nom) => {
    render(<SchemaTp nom={nom} legende={`légende ${nom}`} />)
    expect(screen.getByRole('img').getAttribute('aria-label')!.length).toBeGreaterThan(40)
    expect(screen.getByText(`légende ${nom}`)).toBeInTheDocument()
  })

  it('fait la somme du binaire comme dans les slides', () => {
    render(<SchemaTp nom="binaire" legende="173" />)
    expect(screen.getByRole('img', { name: /128 \+ 32 \+ 8 \+ 4 \+ 1 = 173/ })).toBeInTheDocument()
  })
})

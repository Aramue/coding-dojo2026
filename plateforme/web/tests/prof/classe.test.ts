import { describe, expect, it } from 'vitest'
import { decouperListe } from '../../src/prof/classe'

describe('decouperListe', () => {
  it('lit une colonne par tabulation', () => {
    expect(decouperListe('Camille\tRey\tCalvin')).toEqual([
      { prenom: 'Camille', nom: 'Rey', etablissement: 'Calvin' },
    ])
  })

  it('lit une colonne par point-virgule', () => {
    expect(decouperListe('Camille;Rey;Calvin')).toEqual([
      { prenom: 'Camille', nom: 'Rey', etablissement: 'Calvin' },
    ])
  })

  it('lit une colonne par virgule', () => {
    expect(decouperListe('Camille,Rey,Calvin')[0]!.nom).toBe('Rey')
  })

  it('préfère la tabulation à la virgule', () => {
    // Un nom composé contient une virgule bien plus souvent qu'une tabulation.
    expect(decouperListe('Camille\tRey, Jean\tCalvin')[0]).toEqual({
      prenom: 'Camille',
      nom: 'Rey, Jean',
      etablissement: 'Calvin',
    })
  })

  it('sans séparateur, le premier mot est le prénom et le reste le nom', () => {
    expect(decouperListe('Marie Anne Dupont')[0]).toEqual({
      prenom: 'Marie',
      nom: 'Anne Dupont',
      etablissement: '',
    })
  })

  it('accepte un prénom seul', () => {
    expect(decouperListe('Camille')[0]).toEqual({ prenom: 'Camille', nom: '', etablissement: '' })
  })

  it('lit une ligne par élève', () => {
    const fiches = decouperListe('Camille\tRey\nEnzo\tPoupard\nIziz\tGaston')
    expect(fiches.map((f) => f.prenom)).toEqual(['Camille', 'Enzo', 'Iziz'])
  })

  it('ignore les lignes vides et les espaces de bord', () => {
    expect(decouperListe('\n  Camille\tRey  \n\n   \nEnzo\n')).toHaveLength(2)
  })

  it('ne rend rien sur un texte vide', () => {
    expect(decouperListe('')).toEqual([])
    expect(decouperListe('   \n  \n')).toEqual([])
  })

  it("n'invente pas d'établissement quand la colonne manque", () => {
    expect(decouperListe('Camille\tRey')[0]!.etablissement).toBe('')
  })

  it('retire une colonne vide en tête plutôt que de perdre la ligne', () => {
    // Un copier-coller de tableur en amène souvent une. Sans ce retrait, le
    // prénom serait vide et la ligne ignorée en silence : un élève de moins.
    expect(decouperListe(';Camille;Rey')[0]).toEqual({
      prenom: 'Camille',
      nom: 'Rey',
      etablissement: '',
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  creerEleve,
  decouperListe,
  listerEleves,
  retirerEleve,
} from '../../src/prof/classe'

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

describe('decouperListe — les lignes tordues', () => {
  it('accepte une colonne manquante apres un separateur', () => {
    // Un tableur exporte souvent « Prénom;Nom » sans la colonne établissement.
    expect(decouperListe('Camille;Rey')).toEqual([
      { prenom: 'Camille', nom: 'Rey', etablissement: '' },
    ])
    expect(decouperListe('Camille;')).toEqual([
      { prenom: 'Camille', nom: '', etablissement: '' },
    ])
  })

  it('ignore une ligne qui ne porte aucun prenom', () => {
    // Une ligne de séparateurs seuls, laissée par un copier-coller de tableur.
    expect(decouperListe(';;\nCamille;Rey;Calvin')).toEqual([
      { prenom: 'Camille', nom: 'Rey', etablissement: 'Calvin' },
    ])
  })

  it('rend un prenom seul sans separateur ni nom', () => {
    expect(decouperListe('Camille')).toEqual([
      { prenom: 'Camille', nom: '', etablissement: '' },
    ])
  })
})

describe('appeler — chaque refus a son message', () => {
  function repondre(status: number) {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, json: async () => ({}) })))
  }

  beforeEach(() => vi.unstubAllGlobals())

  it('traduit un prenom manquant', async () => {
    repondre(422)
    await expect(creerEleve('jeton', { prenom: '', nom: '', etablissement: '' })).rejects.toThrow(
      'Le prénom est obligatoire.',
    )
  })

  it("traduit un eleve deja retire", async () => {
    // Deux onglets ouverts sur la classe : l'un supprime, l'autre modifie.
    repondre(404)
    await expect(retirerEleve('jeton', 'DOJO-K7M2')).rejects.toThrow("Cet élève n'existe plus.")
  })

  it('nomme le code des refus qu il ne connait pas', async () => {
    repondre(500)
    await expect(listerEleves('jeton')).rejects.toThrow('erreur 500')
  })
})

describe('decouperListe — la colonne vide en tete', () => {
  it("ne perd pas l eleve quand la ligne commence par un separateur", () => {
    // Un copier-coller de tableur amène souvent une colonne vide devant.
    // Sans le retrait, le prénom serait vide et la ligne silencieusement ignorée.
    expect(decouperListe(';Camille')).toEqual([
      { prenom: 'Camille', nom: '', etablissement: '' },
    ])
  })
})

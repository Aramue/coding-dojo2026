import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import { lireLecon } from '../../src/atelier/lecture'
import { leconEnYaml } from '../../src/atelier/yaml'

/**
 * Le tour complet sur les 14 leçons du dépôt.
 *
 * Même épreuve que pour les exercices : le SENS doit revenir intact, et
 * l'émetteur doit être idempotent. Les leçons ont leur propre style — un
 * texte narratif s'écrit replié, en `>-`, et un bloc de code en `|` — et
 * c'est ce que l'émetteur doit reproduire.
 */

const CONTENU = join(__dirname, '..', '..', '..', 'contenu', 'chapitre-1')

function fichiersDeLecon(): { nom: string; texte: string }[] {
  const trouves: { nom: string; texte: string }[] = []
  for (const seance of readdirSync(CONTENU).filter((d) => d.startsWith('seance-'))) {
    const dossier = join(CONTENU, seance, 'lecons')
    for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.yaml'))) {
      trouves.push({
        nom: `${seance}/${fichier}`,
        texte: readFileSync(join(dossier, fichier), 'utf-8'),
      })
    }
  }
  return trouves
}

const FICHIERS = fichiersDeLecon()

describe('le tour complet sur les leçons', () => {
  it('trouve bien les 14 leçons', () => {
    expect(FICHIERS).toHaveLength(14)
  })

  it.each(FICHIERS.map((f) => [f.nom, f.texte]))('%s se relit sans rien perdre', (_, texte) => {
    const lu = lireLecon(texte)
    const reecrit = leconEnYaml(lu, Number(parse(texte).ordre))
    expect(parse(reecrit)).toEqual(parse(texte))
  })

  it.each(FICHIERS.map((f) => [f.nom, f.texte]))('%s se relit deux fois de suite', (_, texte) => {
    const ordre = Number(parse(texte).ordre)
    const premier = leconEnYaml(lireLecon(texte), ordre)
    expect(leconEnYaml(lireLecon(premier), ordre)).toBe(premier)
  })
})

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import { lireExercice } from '../../src/atelier/lecture'
import { enYaml } from '../../src/atelier/yaml'

/**
 * Le tour complet, sur le vrai corpus : les 112 exercices du dépôt.
 *
 * L'épreuve porte sur le SENS, pas sur les octets. Relire un fichier puis le
 * réécrire doit donner un fichier qui dit exactement la même chose —
 * ==aucune perte silencieuse==. C'est ce qui compte : un champ oublié en
 * chemin ne se verrait qu'en séance.
 *
 * L'identité octet pour octet a été essayée, et elle est hors d'atteinte —
 * pour de bonnes raisons, qui ne sont pas des défauts de l'émetteur :
 *
 * - le corpus n'est pas uniforme. `options` s'écrit sur une ligne dans dix
 *   fichiers et en liste dans trente-trois ; `exige_exact` passe avant
 *   l'`attendu` dans treize ; un indice contenant une apostrophe est entouré
 *   ici et nu là. Ces fichiers ont été écrits à la main sur treize jours.
 * - ==quinze fichiers portent des commentaires==, qui expliquent un choix
 *   pédagogique. Aucun émetteur qui ne préserve pas les commentaires ne peut
 *   les rendre, et les perdre coûterait plus que le gain d'un diff propre.
 *
 * Le style, lui, est verrouillé par l'épreuve caractère par caractère de
 * `yaml.test.ts`, sur un exercice écrit exprès.
 */

const CONTENU = join(__dirname, '..', '..', '..', 'contenu', 'chapitre-1')

function fichiersDExercice(): { nom: string; texte: string }[] {
  const trouves: { nom: string; texte: string }[] = []
  for (const seance of readdirSync(CONTENU).filter((d) => d.startsWith('seance-'))) {
    const dossier = join(CONTENU, seance)
    for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.yaml'))) {
      trouves.push({
        nom: `${seance}/${fichier}`,
        texte: readFileSync(join(dossier, fichier), 'utf-8'),
      })
    }
  }
  return trouves
}

const FICHIERS = fichiersDExercice()

describe('le tour complet sur le corpus réel', () => {
  it('trouve bien les 112 exercices', () => {
    expect(FICHIERS).toHaveLength(112)
  })

  it.each(FICHIERS.map((f) => [f.nom, f.texte]))('%s se relit sans rien perdre', (_, texte) => {
    const reecrit = enYaml(lireExercice(texte))
    // On compare les deux documents analysés : même champs, mêmes valeurs,
    // quel que soit le style d'écriture de chacun.
    expect(parse(reecrit)).toEqual(parse(texte))
  })

  it.each(FICHIERS.map((f) => [f.nom, f.texte]))('%s se relit deux fois de suite', (_, texte) => {
    // Le second tour doit être STABLE : si l'émetteur n'était pas idempotent,
    // chaque passage dans l'atelier reformaterait le fichier un peu plus.
    const premier = enYaml(lireExercice(texte))
    expect(enYaml(lireExercice(premier))).toBe(premier)
  })
})

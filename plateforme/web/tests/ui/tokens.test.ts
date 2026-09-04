import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync('src/ui/tokens.css', 'utf-8')
const base = readFileSync('src/ui/base.css', 'utf-8')

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!)
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}
const lire = (nom: string) => tokens.match(new RegExp(`${nom}:\\s*(#[0-9A-Fa-f]{6})`))![1]!

describe('charte visuelle', () => {
  const familles = [
    ['--var-tint', '--var-ink'],
    ['--typ-tint', '--typ-ink'],
    ['--ope-tint', '--ope-ink'],
    ['--con-tint', '--con-ink'],
    ['--bou-tint', '--bou-ink'],
  ] as const

  it.each(familles)('%s / %s atteint AA', (tint, ink) => {
    expect(contraste(lire(tint), lire(ink))).toBeGreaterThanOrEqual(4.5)
  })

  it('les libelles sur Dracula atteignent AA', () => {
    expect(contraste(lire('--d-label'), lire('--d-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('les couleurs semantiques claires tiennent sur les cinq tints', () => {
    for (const [tint] of familles) {
      expect(contraste(lire('--ok'), lire(tint))).toBeGreaterThanOrEqual(4.5)
      expect(contraste(lire('--ko'), lire(tint))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('les echelles d espacement, de typographie et de rayon sont completes', () => {
    // Sans elles, chaque feuille reinvente ses valeurs et le rythme 4/8
    // annonce par la charte n'existe que sur le papier.
    for (const nom of ['--e-1', '--e-6', '--t-1', '--t-7', '--rayon-1', '--rayon-3']) {
      expect(tokens).toContain(`${nom}:`)
    }
  })

  it('aucune police externe n est chargee', () => {
    expect(base).not.toMatch(/fonts\.googleapis|fontshare|cdn\./)
  })

  it('aucune capitale interlettree dans la feuille de base', () => {
    expect(base).not.toMatch(/text-transform:\s*uppercase/)
  })
})

describe("mise en page de l'ecran d'exercice", () => {
  const appli = readFileSync('src/ui/app.css', 'utf-8')
  const rappel = readFileSync('src/ui/RappelReussite.css', 'utf-8')

  it("declare une largeur de colonne unique", () => {
    expect(appli).toMatch(/--colonne:\s*\d+px/)
  })

  it("aligne le fil, l'en-tete, le rappel et le corps sur cette largeur", () => {
    // Quatre blocs, quatre `max-width` : trois dans app.css, un dans le rappel.
    const occurrences = appli.match(/max-width:\s*var\(--colonne\)/g) ?? []
    expect(occurrences).toHaveLength(3)
    expect(rappel).toMatch(/max-width:\s*var\(--colonne\)/)
  })

  it("ne met jamais la consigne et l'editeur cote a cote", () => {
    // La consigne se lit AVANT d'ecrire. Deux panneaux de poids egal laissent
    // l'eleve balayer de gauche a droite sans savoir par lequel commencer.
    const grille = appli.match(/\.exercice__grille\s*\{[^}]*\}/g) ?? []
    expect(grille.length).toBeGreaterThan(0)
    for (const bloc of grille) expect(bloc).not.toMatch(/grid-template-columns/)
  })
})

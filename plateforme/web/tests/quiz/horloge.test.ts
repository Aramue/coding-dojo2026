import { describe, expect, it } from 'vitest'
import {
  TOLERANCE_MS,
  ecart,
  relectureA,
  restant,
  secondesAffichees,
} from '../../src/quiz/horloge'

const SERVEUR = '2026-09-30T14:00:00.000Z'
const T = Date.parse(SERVEUR)

describe('ecart', () => {
  it('prend le milieu de la requête comme instant de lecture du serveur', () => {
    // Le serveur lit 14:00:00 ; la requête est partie 400 ms plus tôt en heure
    // locale, et revenue 200 ms plus tôt : la machine retarde de 300 ms.
    expect(ecart(SERVEUR, T - 400, T - 200)).toBe(300)
  })

  it('vaut zéro quand les deux horloges sont d accord', () => {
    expect(ecart(SERVEUR, T - 50, T + 50)).toBe(0)
  })

  it('ne casse rien sur une heure illisible', () => {
    expect(ecart('pas une date', T, T)).toBe(0)
  })
})

describe('restant', () => {
  const fin = '2026-09-30T14:00:20.000Z'

  it('décompte sur l heure du serveur, pas sur celle de la machine', () => {
    // La machine retarde de 5 s : il reste 15 s, pas 20.
    expect(restant(fin, 5_000, T)).toBe(15_000)
  })

  it('ne descend jamais sous zéro', () => {
    expect(restant(fin, 0, T + 60_000)).toBe(0)
  })
})

describe('secondesAffichees', () => {
  it('arrondit vers le haut : 0,2 s se lit 1', () => {
    expect(secondesAffichees(200)).toBe(1)
    expect(secondesAffichees(20_000)).toBe(20)
    expect(secondesAffichees(0)).toBe(0)
  })
})

describe('relectureA', () => {
  it('attend la fin de la tolérance, plus une marge, en heure locale', () => {
    const fin = '2026-09-30T14:00:20.000Z'
    const quand = relectureA(fin, 1_000)
    expect(quand).toBeGreaterThan(Date.parse(fin) + TOLERANCE_MS - 1_000)
    expect(quand).toBe(Date.parse(fin) + TOLERANCE_MS + 250 - 1_000)
  })
})

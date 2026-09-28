import { describe, expect, it } from 'vitest'
import {
  aujourdhui,
  chapitresAVenir,
  contenuDisponible,
  dateLongue,
  estDisponible,
} from '../../src/contenu/calendrier'
import type { Chapitre, ContenuPublie, Exercice, Lecon, Notion } from '../../src/contenu/types'

const BASES: Chapitre = { id: 'bases', ordre: 1, titre: 'Les bases de Python', seance: 1 }
const DECISIONS: Chapitre = {
  id: 'decisions',
  ordre: 2,
  titre: 'Calculer, comparer, décider',
  seance: 2,
  ouverture: '2026-09-23',
}

const notion = (id: string, chapitre: string): Notion => ({
  id,
  ordre: 1,
  titre: id,
  famille: 'variables',
  chapitre,
})

const exercice = (id: string, notionId: string): Exercice => ({
  id,
  concept: 'print',
  notion: notionId,
  famille: 'variables',
  seance: 1,
  niveau: 'normal',
  type: 'predire',
  titre: id,
  obligatoire: true,
  enonce: '',
  depart: '',
  indices: [],
  tests: [],
})

const lecon = (id: string, notionId: string): Lecon => ({
  id,
  notion: notionId,
  ordre: 1,
  titre: id,
  dureeMin: 3,
  famille: 'variables',
  blocs: [],
})

const CONTENU: ContenuPublie = {
  chapitres: [BASES, DECISIONS],
  notions: [notion('saisie', 'bases'), notion('calculer', 'decisions')],
  exercices: [exercice('s1-29', 'saisie'), exercice('s2-04', 'calculer')],
  lecons: [lecon('c1-saisie', 'saisie'), lecon('c2-calculer', 'calculer')],
}

describe('aujourdhui', () => {
  it("rend le jour local, au format des dates d'ouverture", () => {
    expect(aujourdhui(new Date(2026, 8, 23, 0, 30))).toBe('2026-09-23')
  })

  it('écrit le mois et le jour sur deux chiffres', () => {
    // Sans zéro, « 2026-9-5 » se comparerait mal à « 2026-09-23 ».
    expect(aujourdhui(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it("prend l'instant présent par défaut", () => {
    expect(aujourdhui()).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  })
})

describe('estDisponible', () => {
  it("ouvre d'emblée un chapitre sans date", () => {
    expect(estDisponible(BASES, '2000-01-01')).toBe(true)
  })

  it('garde un chapitre fermé la veille de sa date', () => {
    expect(estDisponible(DECISIONS, '2026-09-22')).toBe(false)
  })

  it('ouvre un chapitre dès le matin de sa date, et le laisse ouvert', () => {
    expect(estDisponible(DECISIONS, '2026-09-23')).toBe(true)
    expect(estDisponible(DECISIONS, '2026-10-01')).toBe(true)
  })
})

describe('chapitresAVenir', () => {
  it('ne garde que les chapitres encore fermés', () => {
    expect(chapitresAVenir(CONTENU.chapitres, '2026-09-16')).toEqual([DECISIONS])
    expect(chapitresAVenir(CONTENU.chapitres, '2026-09-23')).toEqual([])
  })
})

describe('contenuDisponible', () => {
  it('retire avant sa date le chapitre, ses notions, ses exercices et ses leçons', () => {
    expect(contenuDisponible(CONTENU, '2026-09-16')).toEqual({
      chapitres: [BASES],
      notions: [CONTENU.notions[0]],
      exercices: [CONTENU.exercices[0]],
      lecons: [CONTENU.lecons[0]],
    })
  })

  it('rend tout le contenu le jour de son ouverture', () => {
    expect(contenuDisponible(CONTENU, '2026-09-23')).toEqual(CONTENU)
  })

  it('laisse en place une notion dont le chapitre manque au contenu', () => {
    const avecOrpheline = { ...CONTENU, notions: [...CONTENU.notions, notion('perdue', 'inconnu')] }
    expect(contenuDisponible(avecOrpheline, '2026-09-16').notions.map((n) => n.id)).toEqual([
      'saisie',
      'perdue',
    ])
  })
})

describe('dateLongue', () => {
  it('dit la date comme on la dit dans une salle', () => {
    expect(dateLongue('2026-09-23')).toBe('mercredi 23 septembre')
  })
})

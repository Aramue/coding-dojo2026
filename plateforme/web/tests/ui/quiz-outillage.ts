import { vi } from 'vitest'
import type { EtatEleve, EtatProf, QuestionVue } from '../../src/quiz/types'

/**
 * Une sonnette qui ne s'ouvre jamais : les écrans restent sur leur première
 * lecture et sur les réponses de leurs propres actions. Sans elle, jsdom
 * tenterait une vraie connexion et relancerait des reconnexions en fond.
 */
export class SonnetteMuette {
  onopen: (() => void) | null = null
  onmessage: (() => void) | null = null
  onclose: (() => void) | null = null
  send() {}
  close() {}
}

export function poserSonnetteMuette() {
  vi.stubGlobal('WebSocket', SonnetteMuette)
}

export const MAINTENANT = '2026-09-30T14:00:00.000Z'

export function question(surcharge: Partial<QuestionVue> = {}): QuestionVue {
  return {
    rang: 0,
    total: 12,
    enonce: "Qu'affiche ce programme ?",
    code: 'print("2" + "2")',
    options: ['4', '22', '2 2', 'Une erreur'],
    duree_s: 20,
    ouverte_le: new Date(Date.now()).toISOString(),
    fin_a: new Date(Date.now() + 20_000).toISOString(),
    ...surcharge,
  }
}

export function etatEleve(surcharge: Partial<Extract<EtatEleve, { partie: number }>> = {}): EtatEleve {
  return {
    partie: 1,
    titre: 'Les bases de la séance 1',
    phase: 'attente',
    maintenant: new Date(Date.now()).toISOString(),
    rejoint: true,
    question: null,
    ma_reponse: null,
    moi: { points: 0, bonnes: 0, questions_closes: 0, rang: null, participants: 3 },
    ...surcharge,
  }
}

export function etatProf(surcharge: Partial<Extract<EtatProf, { partie: number }>> = {}): EtatProf {
  return {
    partie: 1,
    quiz_id: 'q1-bases',
    titre: 'Les bases de la séance 1',
    phase: 'attente',
    maintenant: new Date(Date.now()).toISOString(),
    total_questions: 12,
    participants: [],
    question: null,
    derniere: false,
    reponses_recues: 0,
    repartition: null,
    podium: [],
    bilan: null,
    ...surcharge,
  }
}

export function reponse(corps: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => corps }
}

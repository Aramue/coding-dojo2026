import { describe, expect, it, vi } from 'vitest'
import { Executeur } from '../../src/execution/executeur'

/**
 * Faux Worker, comme le vrai : il dit `demarre` quand Python est prêt
 * (`demarrageMs`, jamais si null), puis rend le résultat `delaiMs` plus tard
 * (jamais si null : une boucle infinie).
 */
class WorkerFactice {
  onmessage: ((e: { data: unknown }) => void) | null = null
  termine = false
  constructor(
    private charge: unknown,
    private delaiMs: number | null,
    private demarrageMs: number | null = 0,
  ) {}
  postMessage(demande: { id: string }) {
    if (this.demarrageMs === null) return
    setTimeout(() => {
      if (this.termine) return
      this.onmessage?.({ data: { id: demande.id, demarre: true } })
      if (this.delaiMs === null) return
      setTimeout(() => {
        if (!this.termine) this.onmessage?.({ data: { id: demande.id, ok: true, charge: this.charge } })
      }, this.delaiMs)
    }, this.demarrageMs)
  }
  terminate() {
    this.termine = true
  }
}

const CHARGE = { stdout: 'Bonjour\n', erreur: null, variables: {} }

describe('Executeur', () => {
  it('renvoie le resultat du worker', async () => {
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 1) as unknown as Worker)
    const r = await ex.executer({ code: 'print("Bonjour")', entrees: [], nomsVariables: [] })
    expect(r.stdout).toBe('Bonjour\n')
    expect(r.timeout).toBe(false)
    expect(r.dureeMs).toBeGreaterThanOrEqual(0)
  })

  it('mesure une duree', async () => {
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 5) as unknown as Worker)
    const r = await ex.executer({ code: 'x = 1', entrees: [], nomsVariables: [] })
    expect(r.dureeMs).toBeGreaterThan(0)
  })

  it('rend timeout=true et tue le worker quand le delai est depasse', async () => {
    vi.useFakeTimers()
    // Le premier worker créé : après le dépassement, un remplaçant est créé
    // aussitôt, et c'est bien le premier qui doit avoir été tué.
    let cree: WorkerFactice | null = null
    const ex = new Executeur(() => {
      const nouveau = new WorkerFactice(CHARGE, null)
      cree ??= nouveau
      return nouveau as unknown as Worker
    }, 5000)
    const promesse = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(5001)
    const r = await promesse
    expect(r.timeout).toBe(true)
    expect(r.erreur?.type).toBe('TimeoutError')
    expect(cree!.termine).toBe(true)
    vi.useRealTimers()
  })

  it('ne compte pas le démarrage de Python dans les 5 secondes du programme', async () => {
    // Le défaut d'origine : 8 s de chargement sur un PC de salle, un programme
    // d'une milliseconde, et l'élève lisait « Ton programme tourne en rond ».
    vi.useFakeTimers()
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 1, 8000) as unknown as Worker, 5000)
    const promesse = ex.executer({ code: 'lettre = chr(117)', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(8002)
    const r = await promesse
    expect(r.timeout).toBe(false)
    expect(r.stdout).toBe('Bonjour\n')
    vi.useRealTimers()
  })

  it('compte les 5 secondes à partir du début du programme, pas du clic', async () => {
    vi.useFakeTimers()
    const ex = new Executeur(() => new WorkerFactice(CHARGE, null, 3000) as unknown as Worker, 5000)
    let fini = false
    const promesse = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] }).then((r) => {
      fini = true
      return r
    })
    // 3 s de démarrage + 4,9 s de programme : pas encore coupé.
    await vi.advanceTimersByTimeAsync(7900)
    expect(fini).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    const r = await promesse
    expect(r.timeout).toBe(true)
    expect(r.erreur?.type).toBe('TimeoutError')
    vi.useRealTimers()
  })

  it('un Python qui ne démarre jamais ne se fait pas passer pour une boucle infinie', async () => {
    vi.useFakeTimers()
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 1, null) as unknown as Worker, 5000, 60000)
    const promesse = ex.executer({ code: 'x = 1', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(60001)
    const r = await promesse
    expect(r.timeout).toBe(false)
    expect(r.erreur?.type).toBe('DemarrageImpossible')
    vi.useRealTimers()
  })

  it('prechauffer crée le worker sans rien exécuter, une seule fois', () => {
    let creations = 0
    const ex = new Executeur(() => {
      creations++
      return new WorkerFactice(CHARGE, 1) as unknown as Worker
    })
    ex.prechauffer()
    ex.prechauffer()
    expect(creations).toBe(1)
  })

  it('après un dépassement, un nouveau worker démarre aussitôt, sans attendre la demande suivante', async () => {
    vi.useFakeTimers()
    let creations = 0
    const ex = new Executeur(() => {
      creations++
      return new WorkerFactice(CHARGE, creations === 1 ? null : 1) as unknown as Worker
    }, 5000)
    const p1 = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(5001)
    await p1
    // Le remplaçant existe déjà : il charge Python pendant que l'élève lit le message.
    expect(creations).toBe(2)
    vi.useRealTimers()
  })

  it('recree un worker apres un timeout', async () => {
    vi.useFakeTimers()
    let nombreCreations = 0
    const ex = new Executeur(() => {
      nombreCreations++
      return new WorkerFactice(CHARGE, nombreCreations === 1 ? null : 1) as unknown as Worker
    }, 5000)
    const p1 = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(5001)
    await p1
    vi.useRealTimers()
    const r2 = await ex.executer({ code: 'print("Bonjour")', entrees: [], nomsVariables: [] })
    expect(r2.timeout).toBe(false)
    expect(nombreCreations).toBe(2)
  })
})

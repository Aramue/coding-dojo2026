import { describe, expect, it, vi } from 'vitest'
import { Executeur } from '../../src/execution/executeur'

/** Faux Worker : répond après `delaiMs`, ou jamais si `delaiMs` est null. */
class WorkerFactice {
  onmessage: ((e: { data: unknown }) => void) | null = null
  termine = false
  constructor(
    private charge: unknown,
    private delaiMs: number | null,
  ) {}
  postMessage(demande: { id: string }) {
    if (this.delaiMs === null) return
    setTimeout(() => this.onmessage?.({ data: { id: demande.id, ok: true, charge: this.charge } }), this.delaiMs)
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
    let cree: WorkerFactice | null = null
    const ex = new Executeur(() => {
      cree = new WorkerFactice(CHARGE, null)
      return cree as unknown as Worker
    }, 5000)
    const promesse = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(5001)
    const r = await promesse
    expect(r.timeout).toBe(true)
    expect(r.erreur?.type).toBe('TimeoutError')
    expect(cree!.termine).toBe(true)
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

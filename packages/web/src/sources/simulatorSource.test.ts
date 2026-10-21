import { describe, expect, it } from 'vitest'
import { loadSimulatorDataset } from './simulatorSource'
import { loadDataset } from './mockupSource'
import { CONTROLS, PITCH_TYPES } from '@/domain/simulator'

/**
 * Corre sobre los artefactos reales, como `mockupSource.test.ts`: si
 * `analysis/simulator_evidence.py` o `simulator_gates.py` cambian de forma, se
 * entera aqui y no en la demo.
 */

vi.mock('server-only', () => ({}))

describe('los artefactos del Simulador cumplen su contrato', () => {
  it('trae rangos de la liga para cada tipo y cada perilla, con la mediana dentro', async () => {
    const { distributions } = await loadSimulatorDataset()
    for (const pt of PITCH_TYPES) {
      for (const c of CONTROLS) {
        const q = distributions[pt][c]
        expect(q.p5).toBeLessThanOrEqual(q.p50)
        expect(q.p50).toBeLessThanOrEqual(q.p95)
      }
    }
  })

  it('cada lanzador del Radar tiene un arsenal a nivel del mar de donde partir', async () => {
    const [{ arsenals }, { cards }] = await Promise.all([loadSimulatorDataset(), loadDataset()])
    // Una por tarjeta: todas califican con muestra en ambos entornos.
    expect(arsenals.length).toBe(cards.length)
    for (const a of arsenals) {
      const usage = a.sea.reduce((sum, p) => sum + p.usage, 0)
      expect(usage).toBeCloseTo(1, 1)
    }
  })

  it('el mapa trae los dos entornos y los pitches mas y menos efectivos', async () => {
    const { maps } = await loadSimulatorDataset()
    for (const pt of PITCH_TYPES) {
      for (const panel of [maps[pt].sea, maps[pt].hh]) {
        expect(panel.cells.length).toBeGreaterThan(0)
        expect(panel.extremes.some((e) => e.tier === 'most')).toBe(true)
        expect(panel.extremes.some((e) => e.tier === 'least')).toBe(true)
      }
    }
  })

  it('el veredicto de las compuertas dice que modelo contesta', async () => {
    const { validation } = await loadSimulatorDataset()
    expect(validation).not.toBeNull()
    expect(validation?.modelId).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{7}$/)
    expect(validation?.passed).toBeLessThanOrEqual(validation?.total ?? 0)
  })
})

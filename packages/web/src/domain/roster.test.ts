import { describe, expect, it } from 'vitest'
import { selectRadarCohort } from './cohort'
import {
  approximateRoster,
  deploymentBoard,
  deploymentGroups,
  latestCards,
  orderShift,
  homeShare,
  MIN_HOME_PITCHES,
  ROSTER_SIZE,
} from './roster'
import { loadDataset } from '@/sources/mockupSource'

vi.mock('server-only', () => ({}))

describe('el plantel aproximado (ADR 0008)', () => {
  it('son los de mayor proporcion en altitud extrema en 2026, con volumen de habitual', async () => {
    const { seasonsByPitcher } = await loadDataset()
    const ids = approximateRoster(seasonsByPitcher, 2026)
    expect(ids).toHaveLength(ROSTER_SIZE)
    const entries = ids.map((id) => seasonsByPitcher.get(id)?.find((e) => e.season === 2026))
    const shares = entries.map((e) => (e === undefined ? -1 : homeShare(e)))
    for (let i = 1; i < shares.length; i += 1) {
      expect(shares[i - 1]).toBeGreaterThanOrEqual(shares[i] ?? 0)
    }
    for (const e of entries) expect(e?.nPitchesHh ?? 0).toBeGreaterThanOrEqual(MIN_HOME_PITCHES)
  })

  it('no se carga a un solo rol: contar lanzamientos daba 11 abridores y 3 relevistas', async () => {
    const { cards, seasonsByPitcher } = await loadDataset()
    const roster = latestCards(cards, approximateRoster(seasonsByPitcher, 2026))
    const starters = roster.filter((c) => c.role === 'starter').length
    const relievers = roster.filter((c) => c.role === 'reliever').length
    expect(Math.min(starters, relievers)).toBeGreaterThanOrEqual(4)
  })

  it('en el tablero, cada lanzador entra con su ultima temporada con score', async () => {
    const { cards, seasonsByPitcher } = await loadDataset()
    const roster = latestCards(cards, approximateRoster(seasonsByPitcher, 2026))
    for (const card of roster) {
      const later = cards.filter((c) => c.pitcherId === card.pitcherId && c.season > card.season)
      expect(later).toHaveLength(0)
    }
  })
})

describe('el tablero de despliegue', () => {
  it('las posiciones de casa y de gira son permutaciones, y el cambio es gira menos casa', async () => {
    const { cards, seasonsByPitcher } = await loadDataset()
    const board = deploymentBoard(latestCards(cards, approximateRoster(seasonsByPitcher, 2026)))
    const expected = board.map((_, i) => i + 1)
    expect([...board.map((r) => r.rankHh)].sort((a, b) => a - b)).toEqual(expected)
    expect([...board.map((r) => r.rankSea)].sort((a, b) => a - b)).toEqual(expected)
    for (const r of board) expect(r.move).toBe(r.rankSea - r.rankHh)
  })

  it('agrupa por rol y ordena por el Stuff+ del entorno elegido, nunca por el Δ', async () => {
    const { cards, seasonsByPitcher } = await loadDataset()
    const roster = latestCards(cards, approximateRoster(seasonsByPitcher, 2026))
    for (const env of ['hh', 'sea'] as const) {
      for (const group of deploymentGroups(roster, env)) {
        const v = group.cards.map((c) => (env === 'hh' ? c.stuffPlusHh : c.stuffPlusSea).value)
        for (let i = 1; i < v.length; i += 1) expect(v[i - 1]).toBeGreaterThanOrEqual(v[i] ?? 0)
        for (const c of group.cards) expect(c.role).toBe(group.role)
      }
    }
  })
})

describe('lo que justifica la pantalla, sobre la cohorte del Radar', () => {
  it('el orden cambia entre casa y gira: Spearman 0.638, cambio mediano 40.25, 8 de 10', async () => {
    const { cards, seasonsByPitcher } = await loadDataset()
    const shift = orderShift(selectRadarCohort(cards, seasonsByPitcher))
    expect(shift.n).toBe(296)
    // Cruzado con una corrida independiente en Python, con rangos promedio.
    expect(shift.rankCorrelation).toBeCloseTo(0.63845, 4)
    expect(shift.medianMove).toBe(40.25)
    expect(shift.topTenTurnover).toBe(8)
  })
})

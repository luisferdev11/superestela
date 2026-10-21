import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { evidencePath, mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { selectRadarCohort, summarize } from './cohort'
import {
  DEFAULT_RADAR_SORT,
  firstDirection,
  focusOf,
  rankBy,
  rankCorrelation,
  scoreIn,
  sortRadar,
} from './ranking'
import { nextSort } from './tableSort'
import { MIN_PLATE_APPEARANCES_FOR_RATE } from './constants'
vi.mock('server-only', () => ({}))

import { loadLocations } from '@/sources/locationSource'

/**
 * `README`, regla 2: ningun numero sin su corrida.
 *
 * Todo lo que la P1 muestra en su encabezado se deriva aqui y se compara contra
 * `evidence.json` — la corrida que lo respalda— en vez de contra literales. Si
 * alguien re-corre `analysis/evidence.py` y las cifras se mueven, CI lo dice
 * antes que el deck.
 */

const load = async () => {
  const parsed = mockupDataSchema.parse(JSON.parse(await readFile(mockupDataPath(), 'utf8')))
  const evidence: unknown = JSON.parse(await readFile(evidencePath(), 'utf8'))
  const cards = parsed.pitchers.map(toPitcherSeason)
  const seasonsByPitcher = new Map(
    Object.entries(parsed.pitcher_seasons).map(([id, seasons]) => [id, seasons.map(toSeasonEntry)]),
  )
  return { cards, seasonsByPitcher, evidence: evidence as Evidence }
}

type Evidence = {
  cohort: { n_cards: number; n_pitchers: number; n_traps: number }
}

describe('la cohorte de la P1 coincide con la corrida', () => {
  it('tiene una fila por lanzador con score', async () => {
    const { cards, seasonsByPitcher, evidence } = await load()
    expect(cards).toHaveLength(evidence.cohort.n_cards)
    expect(selectRadarCohort(cards, seasonsByPitcher)).toHaveLength(evidence.cohort.n_pitchers)
  })

  it('cada uno entra con su ultima temporada jugada', async () => {
    const { cards, seasonsByPitcher, evidence } = await load()
    const cohort = selectRadarCohort(cards, seasonsByPitcher)
    for (const card of cohort) {
      const scored = (seasonsByPitcher.get(card.pitcherId) ?? [])
        .filter((s) => s.scored)
        .map((s) => s.season)
      expect(card.season).toBe(Math.max(...scored))
    }
    const summary = summarize(cohort)
    expect([...summary.bySeason.values()].reduce((a, b) => a + b, 0)).toBe(
      evidence.cohort.n_pitchers,
    )
  })

  it('las trampas de las tarjetas son las que dice evidence.json', async () => {
    const { cards, evidence } = await load()
    expect(summarize(cards).nTraps).toBe(evidence.cohort.n_traps)
  })

  it('el encabezado nunca promete mas impuesto concluyente del que hay', async () => {
    const { cards, seasonsByPitcher } = await load()
    const cohort = selectRadarCohort(cards, seasonsByPitcher)
    const summary = summarize(cohort)
    expect(summary.nConclusiveTax).toBeLessThan(summary.nPitchers)
    expect(summary.nConclusiveTax).toBe(cohort.filter((c) => c.altitudeTax !== null).length)
  })
})

describe('el contraste entre entornos es el producto', () => {
  it('ordenar por nivel del mar produce un orden visiblemente distinto', async () => {
    const { cards, seasonsByPitcher } = await load()
    const cohort = selectRadarCohort(cards, seasonsByPitcher)

    // Si esto sube cerca de 1, el toggle deja de demostrar nada y hay que
    // saberlo: seria el modelo aplanando el efecto de altitud, no un test
    // molesto.
    expect(rankCorrelation(cohort)).toBeLessThan(0.8)

    const topHh = rankBy(cohort, 'hh').slice(0, 10)
    const topSea = new Set(
      rankBy(cohort, 'sea')
        .slice(0, 10)
        .map((c) => c.pitcherId),
    )
    const shared = topHh.filter((c) => topSea.has(c.pitcherId)).length
    expect(shared).toBeLessThan(6)
  })

  it('ordena de mayor a menor en el entorno pedido', async () => {
    const { cards } = await load()
    for (const environment of ['hh', 'sea'] as const) {
      const ranked = rankBy(cards, environment)
      const scores = ranked.map((card) => scoreIn(card, environment))
      expect(scores).toEqual([...scores].sort((a, b) => b - a))
    }
  })
})

describe('las tasas del Radar son las de la Ficha', () => {
  it('cada fila trae las tasas en altitud extrema de su temporada, banda incluida', async () => {
    const { cards, seasonsByPitcher } = await load()
    for (const card of selectRadarCohort(cards, seasonsByPitcher)) {
      const entry = seasonsByPitcher.get(card.pitcherId)?.find((s) => s.season === card.season)
      expect(card.ratesHh).toEqual(entry?.outcomesHh)
    }
  })

  it('debajo del minimo de turnos K-BB% se da igual, con su banda (20 oct)', async () => {
    const { cards, seasonsByPitcher } = await load()
    const cohort = selectRadarCohort(cards, seasonsByPitcher)
    const thin = cohort.filter(
      (c) =>
        c.ratesHh.plateAppearances > 0 &&
        c.ratesHh.plateAppearances < MIN_PLATE_APPEARANCES_FOR_RATE,
    )
    expect(thin.length).toBeGreaterThan(0)
    for (const card of thin) expect(card.ratesHh.kMinusBbPct).not.toBeNull()
  })

  it('cada fila trae su Location+ en altitud extrema, o null sin el', async () => {
    const { cards, seasonsByPitcher } = await load()
    const locations = await loadLocations()
    const cohort = selectRadarCohort(cards, seasonsByPitcher, locations)
    expect(cohort.some((c) => c.locationPlusHh !== null)).toBe(true)
    for (const card of cohort) {
      const panel = locations?.get(`${card.pitcherId}/${String(card.season)}`)?.hh ?? null
      expect(card.locationPlusHh).toEqual(panel?.locationPlus ?? null)
    }
    expect(selectRadarCohort(cards, seasonsByPitcher).every((c) => c.locationPlusHh === null)).toBe(
      true,
    )
  })
})

describe('ordenar el radar por columna', () => {
  const nullsLast = (values: readonly (number | null)[], direction: 'desc' | 'asc') => {
    const firstNull = values.indexOf(null)
    const known = (firstNull === -1 ? values : values.slice(0, firstNull)) as number[]
    const ordered = known.every((v, i) =>
      i === 0 ? true : direction === 'desc' ? (known[i - 1] ?? v) >= v : (known[i - 1] ?? v) <= v,
    )
    const tailIsNull = firstNull === -1 || values.slice(firstNull).every((v) => v === null)
    return ordered && tailIsNull
  }

  it('K-BB% de mayor a menor y al reves, con la muestra insuficiente siempre al final', async () => {
    const { cards, seasonsByPitcher } = await load()
    const cohort = selectRadarCohort(cards, seasonsByPitcher)
    for (const direction of ['desc', 'asc'] as const) {
      const sorted = sortRadar(cohort, { key: 'kMinusBb', direction })
      const values = sorted.map((c) => c.ratesHh.kMinusBbPct?.value ?? null)
      expect(nullsLast(values, direction)).toBe(true)
    }
  })

  it('Location+ ordena de mayor a menor; los que no lo tienen van al final', async () => {
    const { cards: all, seasonsByPitcher } = await load()
    const cards = selectRadarCohort(all, seasonsByPitcher, await loadLocations())
    const sorted = sortRadar(cards, { key: 'locationPlus', direction: 'desc' })
    const values = sorted.map((c) => c.locationPlusHh?.value ?? null)
    expect(nullsLast(values, 'desc')).toBe(true)
    expect(values[0]).not.toBeNull()
  })

  it('con un pitch elegido, ordena por el Stuff+ de ese pitch', async () => {
    const { cards: all, seasonsByPitcher } = await load()
    const cards = selectRadarCohort(all, seasonsByPitcher)
    const withSlider = cards.filter((c) => c.arsenal.some((e) => e.pitch === 'Slider'))
    const sorted = sortRadar(withSlider, DEFAULT_RADAR_SORT, 'Slider')
    const values = sorted.map((c) => focusOf(c, 'Slider').hh?.value ?? null)
    expect(nullsLast(values, 'desc')).toBe(true)
    expect(focusOf(sorted[0] ?? withSlider[0]!, 'Slider').pitch).toBe('Slider')
  })

  it('el nombre empieza de la A a la Z, y un segundo clic invierte', () => {
    expect(firstDirection('pitcher')).toBe('asc')
    expect(firstDirection('locationPlus')).toBe('desc')
    const once = nextSort(DEFAULT_RADAR_SORT, 'locationPlus', firstDirection('locationPlus'))
    expect(once).toEqual({ key: 'locationPlus', direction: 'desc' })
    expect(nextSort(once, 'locationPlus', firstDirection('locationPlus'))).toEqual({
      key: 'locationPlus',
      direction: 'asc',
    })
  })
})

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import {
  cardsOf,
  fichaHref,
  hasGap,
  pickSeason,
  pitcherParams,
  pitcherSeasonParams,
  rankInSeason,
  seasonTimeline,
} from './pitcher'
import { MIN_PITCHES_FOR_SCORE } from './constants'

/** Sobre el `mockup_data.json` real: las cifras de la Ficha son las del artefacto. */
const load = async () => {
  const parsed = mockupDataSchema.parse(JSON.parse(await readFile(mockupDataPath(), 'utf8')))
  return {
    cards: parsed.pitchers.map(toPitcherSeason),
    seasons: new Map(
      Object.entries(parsed.pitcher_seasons).map(([id, s]) => [id, s.map(toSeasonEntry)]),
    ),
  }
}

describe('la Ficha de pitcher_00069', () => {
  it('sin temporada pedida abre la ultima con score', async () => {
    const { cards, seasons } = await load()
    const scored = (seasons.get('pitcher_00069') ?? []).filter((e) => e.scored).map((e) => e.season)
    expect(pickSeason(cardsOf(cards, 'pitcher_00069'))?.season).toBe(Math.max(...scored))
  })

  it('su 2025 trae las cifras del artefacto', async () => {
    const { cards } = await load()
    const card = pickSeason(cardsOf(cards, 'pitcher_00069'), 2025)
    expect(card?.season).toBe(2025)
    expect(card?.stuffPlusHh).toEqual({ value: 97.7, se: 0.8 })
    expect(card?.stuffPlusSea).toEqual({ value: 110.8, se: 0.9 })
    expect(card?.stuffPlusDelta).toBe(-13)
    expect(card?.altitudeTax).toBeNull()
    // The artifact's standard error (2.70) is shown as the 95% half-width.
    expect(card?.altitudeTaxMeasured?.value).toBe(4.55)
    expect(card?.altitudeTaxMeasured?.se).toBeCloseTo(1.96 * 2.7, 9)
    expect(card?.role).toBe('starter')
    expect(card?.altitudeTrap).toBe(true)
  })

  it('con el minimo de 50, su 2026 (86 a nivel del mar) ya tiene score', async () => {
    const { cards, seasons } = await load()
    const rows = seasonTimeline(seasons.get('pitcher_00069') ?? [], cardsOf(cards, 'pitcher_00069'))
    expect(rows.map((r) => [r.season, r.status])).toEqual([
      [2025, 'scored'],
      [2026, 'scored'],
    ])
  })

  it('una temporada debajo de 50 a nivel del mar sale como sin score por el nivel del mar', async () => {
    const { cards, seasons } = await load()
    const short = [...seasons].flatMap(([id, entries]) =>
      entries
        .filter(
          (e) =>
            !e.scored &&
            e.nPitchesSea < MIN_PITCHES_FOR_SCORE &&
            e.nPitchesHh >= MIN_PITCHES_FOR_SCORE,
        )
        .map((e) => ({ id, season: e.season })),
    )
    expect(short.length).toBeGreaterThan(0)
    for (const { id, season } of short) {
      const row = seasonTimeline(seasons.get(id) ?? [], cardsOf(cards, id)).find(
        (r) => r.season === season,
      )
      expect(row?.status).toBe('shortSea')
    }
  })

  it('con muestra en los dos entornos pero sin arsenal que puntuar dice por que, no que falta muestra', async () => {
    const { cards, seasons } = await load()
    const thin = [...seasons].flatMap(([id, entries]) =>
      entries
        .filter((e) => !e.scored && Math.min(e.nPitchesSea, e.nPitchesHh) >= MIN_PITCHES_FOR_SCORE)
        .map((e) => ({ id, season: e.season })),
    )
    expect(thin.length).toBeGreaterThan(0)
    for (const { id, season } of thin) {
      const row = seasonTimeline(seasons.get(id) ?? [], cardsOf(cards, id)).find(
        (r) => r.season === season,
      )
      expect(row?.status).toBe('thinArsenal')
    }
  })

  it('una temporada que no existe no se inventa', async () => {
    const { cards } = await load()
    expect(pickSeason(cardsOf(cards, 'pitcher_00069'), 2024)).toBeNull()
  })
})

describe('el hueco entre temporadas (ADR 0005)', () => {
  it('pitcher_00076 lanzo 2024 y 2026: 2025 sale como fila ausente, no como promedio', async () => {
    const { cards, seasons } = await load()
    const rows = seasonTimeline(seasons.get('pitcher_00076') ?? [], cardsOf(cards, 'pitcher_00076'))
    expect(rows.map((r) => r.season)).toEqual([2024, 2025, 2026])
    expect(rows[1]).toMatchObject({ status: 'absent', nPitchesHh: null, nPitchesSea: null })
    expect(hasGap(rows)).toBe(true)
  })

  it('quien lanzo en temporadas seguidas no tiene hueco', async () => {
    const { cards, seasons } = await load()
    const rows = seasonTimeline(seasons.get('pitcher_00069') ?? [], cardsOf(cards, 'pitcher_00069'))
    expect(hasGap(rows)).toBe(false)
  })
})

describe('el lugar en la liga', () => {
  it('va de 1 al total de tarjetas de su temporada, en los dos entornos', async () => {
    const { cards } = await load()
    for (const card of cards) {
      for (const env of ['hh', 'sea'] as const) {
        const { rank, of } = rankInSeason(cards, card, env)
        expect(rank).toBeGreaterThanOrEqual(1)
        expect(rank).toBeLessThanOrEqual(of)
      }
    }
  })
})

describe('las paginas que se generan', () => {
  it('una por lanzador con score, sin repetidos, y una por cada tarjeta', async () => {
    const { cards } = await load()
    const ids = pitcherParams(cards).map((p) => p.pitcherId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(new Set(cards.map((c) => c.pitcherId)).size)
    expect(pitcherSeasonParams(cards)).toHaveLength(cards.length)
  })

  it('la liga lleva la temporada solo cuando se pide', () => {
    expect(fichaHref('pitcher_00069')).toBe('/pitchers/pitcher_00069')
    expect(fichaHref('pitcher_00069', 2025)).toBe('/pitchers/pitcher_00069/2025')
  })
})

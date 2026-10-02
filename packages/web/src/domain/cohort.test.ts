import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { evidencePath, mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { selectRadarCohort, summarize } from './cohort'
import { rankBy, rankCorrelation, scoreIn, sortRadar } from './ranking'

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
  seasons: { scored_pitchers: number; last_scored_season: Record<string, number> }
}

describe('la cohorte de la P1 coincide con la corrida', () => {
  it('tiene una fila por lanzador con score', async () => {
    const { cards, seasonsByPitcher, evidence } = await load()
    expect(cards).toHaveLength(evidence.cohort.n_cards)
    expect(selectRadarCohort(cards, seasonsByPitcher)).toHaveLength(
      evidence.seasons.scored_pitchers,
    )
  })

  it('cada uno entra con su ultima temporada jugada', async () => {
    const { cards, seasonsByPitcher, evidence } = await load()
    const summary = summarize(selectRadarCohort(cards, seasonsByPitcher))
    const bySeason = Object.fromEntries(
      [...summary.bySeason].map(([season, count]) => [String(season), count]),
    )
    expect(bySeason).toEqual(evidence.seasons.last_scored_season)
  })

  it('las trampas de las 370 tarjetas son las que dice evidence.json', async () => {
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

describe('ordenar por las tasas que lee Diablos', () => {
  it('K-BB% de mayor a menor, y la muestra insuficiente al final', async () => {
    const { cards } = await load()
    const sorted = sortRadar(cards, 'kMinusBb')
    const values = sorted.map((c) => c.outcomes.kMinusBbPct?.value ?? null)
    const firstNull = values.indexOf(null)
    const known = (firstNull === -1 ? values : values.slice(0, firstNull)) as number[]
    expect(known.every((v, i) => i === 0 || (known[i - 1] ?? v) >= v)).toBe(true)
    if (firstNull !== -1) expect(values.slice(firstNull).every((v) => v === null)).toBe(true)
  })
})

import { locationKey, type PitcherLocation } from './location'
import type { Metric, Outcomes, PitcherSeason, SeasonEntry } from './types'

/**
 * La cohorte de la P1: cada candidato en **su ultima temporada jugada con
 * score**. No es un detalle de presentacion — 95 candidatos tienen 2024, 134 el
 * 2025 y solo 67 el 2026, asi que promediar o tomar la ultima temporada del
 * dataset describiria a gente distinta de la que existe (`docs/adr/0005`).
 */
export const lastScoredSeason = (seasons: readonly SeasonEntry[]): number | null => {
  const scored = seasons.filter((season) => season.scored).map((season) => season.season)
  return scored.length > 0 ? Math.max(...scored) : null
}

/**
 * A Radar row: the card plus the rates of that season in extreme altitude,
 * the environment the Radar ranks by. They are the same numbers the Ficha's
 * outcomes table shows for that season and environment, band and sample
 * minimum included. And its Location+ in extreme altitude (data's L3), `null`
 * without the model or the sample.
 */
export type RadarCard = PitcherSeason & {
  readonly ratesHh: Outcomes
  readonly locationPlusHh: Metric | null
}

export const selectRadarCohort = (
  cards: readonly PitcherSeason[],
  seasonsByPitcher: ReadonlyMap<string, readonly SeasonEntry[]>,
  locations: ReadonlyMap<string, PitcherLocation> | null = null,
): readonly RadarCard[] =>
  cards.flatMap((card) => {
    const seasons = seasonsByPitcher.get(card.pitcherId)
    if (seasons === undefined || lastScoredSeason(seasons) !== card.season) return []
    const entry = seasons.find((season) => season.season === card.season)
    if (entry === undefined) return []
    const location = locations?.get(locationKey(card.pitcherId, card.season))
    return [
      {
        ...card,
        ratesHh: entry.outcomesHh,
        locationPlusHh: location?.hh?.locationPlus ?? null,
      },
    ]
  })

export type CohortSummary = {
  readonly nPitchers: number
  readonly nConclusiveTax: number
  readonly nTraps: number
  readonly bySeason: ReadonlyMap<number, number>
}

/**
 * El resumen que encabeza la pantalla. Se **deriva** de los datos y no se
 * escribe en el JSX: `CONVENTIONS.md` seccion 8, ningun numero sin su corrida.
 * Un test lo compara contra `evidence.json`.
 */
export const summarize = (cards: readonly PitcherSeason[]): CohortSummary => {
  const bySeason = new Map<number, number>()
  for (const card of cards) {
    bySeason.set(card.season, (bySeason.get(card.season) ?? 0) + 1)
  }

  return {
    nPitchers: cards.length,
    nConclusiveTax: cards.filter((card) => card.altitudeTax !== null).length,
    nTraps: cards.filter((card) => card.altitudeTrap).length,
    bySeason,
  }
}

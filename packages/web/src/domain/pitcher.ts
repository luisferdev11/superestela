import type { Route } from 'next'
import { MIN_PITCHES_FOR_SCORE } from './constants'
import type { Environment, PitcherSeason, Role, SeasonEntry } from './types'

/**
 * La Ficha de un lanzador (P2, `docs/02`). Todo lo que la pantalla decide vive
 * aqui y no en los componentes (`CONVENTIONS.md` seccion 4, regla 6).
 */

/** Sus tarjetas con score, de la mas vieja a la mas reciente. */
export const cardsOf = (
  cards: readonly PitcherSeason[],
  pitcherId: string,
): readonly PitcherSeason[] =>
  cards.filter((c) => c.pitcherId === pitcherId).sort((a, b) => a.season - b.season)

/** La temporada pedida, o la ultima con score si no se pide ninguna. */
export const pickSeason = (
  cards: readonly PitcherSeason[],
  season?: number,
): PitcherSeason | null =>
  season === undefined
    ? (cards[cards.length - 1] ?? null)
    : (cards.find((c) => c.season === season) ?? null)

/**
 * Por que una temporada no tiene score. `absent` es el hueco de ADR 0005: no
 * lanzo en todo el ano, y la Ficha lo deja ver en vez de promediar alrededor.
 */
export type SeasonStatus = 'scored' | 'shortSea' | 'shortHh' | 'shortBoth' | 'absent'

export type SeasonRow = {
  readonly season: number
  readonly status: SeasonStatus
  readonly nPitchesHh: number | null
  readonly nPitchesSea: number | null
  readonly role: Role | null
}

const statusOf = (entry: SeasonEntry): SeasonStatus => {
  if (entry.scored) return 'scored'
  const shortHh = entry.nPitchesHh < MIN_PITCHES_FOR_SCORE
  const shortSea = entry.nPitchesSea < MIN_PITCHES_FOR_SCORE
  if (shortHh && shortSea) return 'shortBoth'
  return shortSea ? 'shortSea' : 'shortHh'
}

/** De su primera a su ultima temporada, con los huecos como filas. */
export const seasonTimeline = (
  entries: readonly SeasonEntry[],
  cards: readonly PitcherSeason[],
): readonly SeasonRow[] => {
  if (entries.length === 0) return []
  const bySeason = new Map(entries.map((e) => [e.season, e]))
  const first = Math.min(...entries.map((e) => e.season))
  const last = Math.max(...entries.map((e) => e.season))
  const rows: SeasonRow[] = []
  for (let season = first; season <= last; season += 1) {
    const entry = bySeason.get(season)
    rows.push(
      entry === undefined
        ? { season, status: 'absent', nPitchesHh: null, nPitchesSea: null, role: null }
        : {
            season,
            status: statusOf(entry),
            nPitchesHh: entry.nPitchesHh,
            nPitchesSea: entry.nPitchesSea,
            role: cards.find((c) => c.season === season)?.role ?? null,
          },
    )
  }
  return rows
}

export const hasGap = (rows: readonly SeasonRow[]): boolean =>
  rows.some((r) => r.status === 'absent')

/** Su lugar entre todas las tarjetas de esa temporada, en un entorno. 1 es el mejor. */
export const rankInSeason = (
  cards: readonly PitcherSeason[],
  card: PitcherSeason,
  environment: Environment,
): { readonly rank: number; readonly of: number } => {
  const value = (c: PitcherSeason): number =>
    environment === 'hh' ? c.stuffPlusHh.value : c.stuffPlusSea.value
  const peers = cards.filter((c) => c.season === card.season)
  return { rank: 1 + peers.filter((c) => value(c) > value(card)).length, of: peers.length }
}

/** 100 es el promedio de la escala de v0 (`docs/adr/0007`). */
export const isAboveAverage = (stuffPlus: number): boolean => stuffPlus >= 100

/**
 * Una pagina por lanzador con score, y una por cada temporada suya con score.
 * Arreglos mutables porque `generateStaticParams` no acepta `readonly`.
 */
export const pitcherParams = (cards: readonly PitcherSeason[]): { pitcherId: string }[] =>
  [...new Set(cards.map((c) => c.pitcherId))].sort().map((pitcherId) => ({ pitcherId }))

export const pitcherSeasonParams = (
  cards: readonly PitcherSeason[],
): { pitcherId: string; season: string }[] =>
  cards.map((c) => ({ pitcherId: c.pitcherId, season: String(c.season) }))

/**
 * `typedRoutes` solo reconoce una ruta dinamica si el id es un literal; el id
 * de un lanzador llega en tiempo de ejecucion, asi que se afirma aqui, una vez,
 * y los componentes reciben un `Route` ya hecho.
 */
export const fichaHref = (pitcherId: string, season?: number): Route =>
  (season === undefined
    ? `/pitchers/${pitcherId}`
    : `/pitchers/${pitcherId}/${String(season)}`) as Route

/** La pestana Arsenal de una temporada. Siempre con temporada: el arsenal es de un ano. */
export const fichaArsenalHref = (pitcherId: string, season: number): Route =>
  `${fichaHref(pitcherId, season)}/arsenal` as Route

/** El Plan de Desarrollo de una temporada (P5). */
export const planHref = (pitcherId: string, season: number): Route =>
  `/plan/${pitcherId}/${String(season)}` as Route

/** La Proyeccion de una temporada (P7). */
export const projectionHref = (pitcherId: string, season: number): Route =>
  `/proyeccion/${pitcherId}/${String(season)}` as Route

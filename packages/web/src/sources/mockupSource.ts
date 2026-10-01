import 'server-only'
import { readFile } from 'node:fs/promises'
import { evidencePath, mockupDataPath } from './paths'
import { leagueShapesSchema, mockupDataSchema } from './schema'
import { evidenceSchema, type EvidenceRaw } from './evidenceSchema'
import { toDensityLevel, toOutcomes, toPitcherSeason, toSeasonEntry } from './adapter'
import { orderByDensity, type DensityScale } from '@/domain/density'
import type { LeagueShapes } from '@/domain/arsenalMap'
import type { Environment, Outcomes, PitcherSeason, SeasonEntry } from '@/domain/types'

/**
 * `server-only` no es decorativo: son 727 KB. Si un componente cliente llega a
 * importar esto, el build falla — que es mejor que descubrirlo en la revision.
 */

export type Dataset = {
  readonly cards: readonly PitcherSeason[]
  readonly seasonsByPitcher: ReadonlyMap<string, readonly SeasonEntry[]>
  readonly density: DensityScale
  /** Del audit: lo que respalda el pie del rail. */
  readonly nPitches: number
  readonly seasons: readonly number[]
  /** Los que se ausentaron una temporada completa y volvieron (ADR 0005). */
  readonly pitchersWithGap: number
  /** La forma promedio de la liga por tipo, a nivel del mar y en altitud extrema. */
  readonly leagueShapes: LeagueShapes
  /** K%, BB%, K-BB% y whiff de la liga en cada entorno (`evidence.json → league_outcomes`). */
  readonly leagueOutcomes: Readonly<Record<Environment, Outcomes>> | null
}

const toLeagueShapes = (raw: unknown, sea: string, extreme: string): LeagueShapes => {
  const pick = (levels: Record<string, { ivb: number; abs_hb: number }>, label: string) => {
    const level = levels[label]
    return level === undefined ? null : { ivb: level.ivb, absHb: level.abs_hb }
  }
  return new Map(
    Object.entries(leagueShapesSchema.parse(raw)).map(([pitchType, profile]) => [
      pitchType,
      { sea: pick(profile.levels, sea), hh: pick(profile.levels, extreme) },
    ]),
  )
}

/** Lo de la liga en cada entorno, para leer las tasas de un lanzador contra algo. */
const leagueOutcomesOf = (
  raw: EvidenceRaw['league_outcomes'],
  seaLabel: string,
  extremeLabel: string,
): Record<Environment, Outcomes> | null => {
  const sea = raw[seaLabel]
  const hh = raw[extremeLabel]
  return sea === undefined || hh === undefined ? null : { sea: toOutcomes(sea), hh: toOutcomes(hh) }
}

export const loadDataset = async (): Promise<Dataset> => {
  const [mockupRaw, evidenceRaw]: [unknown, unknown] = await Promise.all([
    readFile(mockupDataPath(), 'utf8').then((text): unknown => JSON.parse(text)),
    readFile(evidencePath(), 'utf8').then((text): unknown => JSON.parse(text)),
  ])
  const parsed = mockupDataSchema.parse(mockupRaw)
  const evidence = evidenceSchema.parse(evidenceRaw)

  // Cual entorno es "nivel del mar" y cual "altitud extrema" se decide por la
  // densidad medida, no por la ortografia de la etiqueta.
  const levels = orderByDensity(
    Object.entries(parsed.density).map(([label, level]) => toDensityLevel(label, level)),
  )
  const sea = levels[0]
  const extreme = levels[levels.length - 1]
  if (sea === undefined || extreme === undefined) {
    throw new Error('mockup_data.json no trae ningun entorno con densidad medida')
  }

  return {
    cards: parsed.pitchers.map(toPitcherSeason),
    seasonsByPitcher: new Map(
      Object.entries(parsed.pitcher_seasons).map(([pitcherId, seasons]) => [
        pitcherId,
        seasons.map(toSeasonEntry),
      ]),
    ),
    density: { levels, sea, extreme },
    nPitches: evidence.audit.n_pitches,
    seasons: evidence.audit.seasons,
    pitchersWithGap: evidence.seasons.pitchers_with_a_gap,
    leagueShapes: toLeagueShapes(parsed.pitch_profiles, sea.label, extreme.label),
    leagueOutcomes: leagueOutcomesOf(evidence.league_outcomes, sea.label, extreme.label),
  }
}

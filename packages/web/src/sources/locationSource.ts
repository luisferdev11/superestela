import 'server-only'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { locationsPath, pitchEffectivenessPath, pitchLocationsPath } from './paths'
import type { CountMap, PitchEffectiveness, PitcherLocation, PitchMaps } from '@/domain/location'

const range = z.tuple([z.number(), z.number()])

const band = z.object({ value: z.number(), ci95: z.number().nonnegative() }).strict().nullable()

const panel = z
  .object({
    n_pitches: z.number().int().nonnegative(),
    mean_plate_height_ft: z.number(),
    plate_height_sd_ft: z.number().nonnegative(),
    zone_share: z.number().min(0).max(1),
    whiff_per_swing: z.number().min(0).max(1),
    // data's Location+ (L3) with its 95% band; null without the model or the sample.
    location_plus: band,
    grid: z.array(z.array(z.number().nonnegative())),
    side_range_ft: range,
    height_range_ft: range,
  })
  .strict()

/** El contrato de `docs/11`, en Zod: si datos entrega otra forma, falla aqui con nombre de campo. */
export const locationsSchema = z.record(
  z.string(),
  z.object({ sea: panel.nullable(), hh: panel.nullable() }).strict(),
)

// A map as [row, column, count] of its non-empty cells, on the panels' grid
// (analysis/pitcher_locations.py, 20 oct).
const counts = z
  .object({
    n_pitches: z.number().int().nonnegative(),
    cells: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int().positive()])),
    location_plus: band,
  })
  .strict()

export const pitchLocationsSchema = z.record(
  z.string(),
  z.record(z.string(), z.object({ sea: counts.nullable(), hh: counts.nullable() }).strict()),
)

export const pitchEffectivenessSchema = z.record(
  z.string(),
  z.record(z.string(), z.object({ most: counts, least: counts }).strict()),
)

const toBand = (raw: z.infer<typeof band>) =>
  raw === null ? null : { value: raw.value, se: raw.ci95 }

/** The panels' grid is square: the same number of cells per side as theirs. */
const GRID_CELLS = 10

const toCounts = (raw: z.infer<typeof counts>): CountMap => {
  const grid = Array.from({ length: GRID_CELLS }, () => Array<number>(GRID_CELLS).fill(0))
  for (const [r, c, n] of raw.cells) {
    const row = grid[r]
    if (row !== undefined) row[c] = n
  }
  return { nPitches: raw.n_pitches, counts: grid, locationPlus: toBand(raw.location_plus) }
}

const toPanel = (raw: z.infer<typeof panel> | null) =>
  raw === null
    ? null
    : {
        nPitches: raw.n_pitches,
        meanPlateHeightFt: raw.mean_plate_height_ft,
        plateHeightSdFt: raw.plate_height_sd_ft,
        zoneShare: raw.zone_share,
        whiffPerSwing: raw.whiff_per_swing,
        locationPlus: toBand(raw.location_plus),
        grid: raw.grid,
        sideRangeFt: raw.side_range_ft,
        heightRangeFt: raw.height_range_ft,
      }

/** The file's text, or `null` if it does not exist yet; any other error is raised. */
const readIfPresent = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

/**
 * `null` si el archivo no existe todavia, que es lo esperado hasta que datos
 * lo entregue. Si existe y no cumple el contrato, falla: un archivo roto no se
 * disfraza de pendiente. Sin `pitch_locations.json`, la Ficha no ofrece el
 * filtro por tipo de pitch.
 */
export const loadLocations = async (): Promise<ReadonlyMap<string, PitcherLocation> | null> => {
  const [text, byPitchText] = await Promise.all([
    readIfPresent(locationsPath()),
    readIfPresent(pitchLocationsPath()),
  ])
  if (text === null) return null
  const parsed = locationsSchema.parse(JSON.parse(text) as unknown)
  const byPitch =
    byPitchText === null ? {} : pitchLocationsSchema.parse(JSON.parse(byPitchText) as unknown)
  return new Map(
    Object.entries(parsed).map(([key, v]) => {
      const pitches: Record<string, PitchMaps> = Object.fromEntries(
        Object.entries(byPitch[key] ?? {}).map(([pitch, m]) => [
          pitch,
          {
            sea: m.sea === null ? null : toCounts(m.sea),
            hh: m.hh === null ? null : toCounts(m.hh),
          },
        ]),
      )
      return [key, { sea: toPanel(v.sea), hh: toPanel(v.hh), pitches }]
    }),
  )
}

/** Sus pitches mas y menos efectivos de cada tipo; `null` si el archivo no existe. */
export const loadPitchEffectiveness = async (): Promise<ReadonlyMap<
  string,
  Readonly<Record<string, PitchEffectiveness>>
> | null> => {
  const text = await readIfPresent(pitchEffectivenessPath())
  if (text === null) return null
  const parsed = pitchEffectivenessSchema.parse(JSON.parse(text) as unknown)
  return new Map(
    Object.entries(parsed).map(([key, v]) => [
      key,
      Object.fromEntries(
        Object.entries(v).map(([pitch, m]) => [
          pitch,
          { most: toCounts(m.most), least: toCounts(m.least) },
        ]),
      ),
    ]),
  )
}

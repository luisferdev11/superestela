import 'server-only'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { locationsPath } from './paths'
import type { PitcherLocation } from '@/domain/location'

const range = z.tuple([z.number(), z.number()])

const panel = z
  .object({
    n_pitches: z.number().int().nonnegative(),
    mean_plate_height_ft: z.number(),
    plate_height_sd_ft: z.number().nonnegative(),
    zone_share: z.number().min(0).max(1),
    whiff_per_swing: z.number().min(0).max(1),
    // data's Location+ (L3) with its 95% band; null without the model or the sample.
    location_plus: z
      .object({ value: z.number(), ci95: z.number().nonnegative() })
      .strict()
      .nullable(),
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

const toPanel = (raw: z.infer<typeof panel> | null) =>
  raw === null
    ? null
    : {
        nPitches: raw.n_pitches,
        meanPlateHeightFt: raw.mean_plate_height_ft,
        plateHeightSdFt: raw.plate_height_sd_ft,
        zoneShare: raw.zone_share,
        whiffPerSwing: raw.whiff_per_swing,
        locationPlus:
          raw.location_plus === null
            ? null
            : { value: raw.location_plus.value, se: raw.location_plus.ci95 },
        grid: raw.grid,
        sideRangeFt: raw.side_range_ft,
        heightRangeFt: raw.height_range_ft,
      }

/**
 * `null` si el archivo no existe todavia, que es lo esperado hasta que datos
 * lo entregue. Si existe y no cumple el contrato, falla: un archivo roto no se
 * disfraza de pendiente.
 */
export const loadLocations = async (): Promise<ReadonlyMap<string, PitcherLocation> | null> => {
  let text: string
  try {
    text = await readFile(locationsPath(), 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
  const parsed = locationsSchema.parse(JSON.parse(text) as unknown)
  return new Map(
    Object.entries(parsed).map(([key, v]) => [key, { sea: toPanel(v.sea), hh: toPanel(v.hh) }]),
  )
}

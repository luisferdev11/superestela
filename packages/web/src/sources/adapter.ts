import type { ArsenalEntry, PitcherSeason, SeasonEntry } from '@/domain/types'
import type { PitcherCardRaw } from './schema'
import type { z } from 'zod'
import type { arsenalEntrySchema, seasonEntrySchema } from './schema'

/**
 * El unico lugar del proyecto donde `snake_case` se vuelve `camelCase`.
 * `CONVENTIONS.md` seccion 2.3: los artefactos de analisis son snake_case y el
 * wire es camelCase. Es el espejo de `packages/contracts/mapping.py`.
 *
 * Aqui tambien se aplican dos reglas de producto, y por eso viven en el tipo y
 * no en un componente:
 *   - el score y su banda salen juntos, como un `Metric`;
 *   - un impuesto no significativo se vuelve `null`, porque "no concluyente" no
 *     es un numero con banda enorme, es la ausencia de numero.
 */

const toArsenalEntry = (raw: z.infer<typeof arsenalEntrySchema>): ArsenalEntry => ({
  pitch: raw.pitch,
  usagePct: raw.usage_pct,
  n: raw.n,
  velo: raw.velo,
  ivbHh: raw.ivb_hh,
  ivbSea: raw.ivb_sea,
  hbHh: raw.hb_hh,
  hbSea: raw.hb_sea,
  spin: raw.spin,
  extension: raw.extension,
  stuffPlusHh: raw.stuff_plus_hh,
  stuffPlusSea: raw.stuff_plus_sea,
  whiffPerSwing: raw.whiff_per_swing,
})

export const toPitcherSeason = (raw: PitcherCardRaw): PitcherSeason => ({
  pitcherId: raw.pitcher_id,
  season: raw.season,
  throws: raw.throws,
  nPitchesHh: raw.n_pitches_hh,
  nPitchesSea: raw.n_pitches_sea,
  stuffPlusHh: { value: raw.stuff_plus_hh, se: raw.stuff_plus_hh_ci95 },
  stuffPlusSea: { value: raw.stuff_plus_sea, se: raw.stuff_plus_sea_ci95 },
  stuffPlusDelta: raw.stuff_plus_delta,
  role: raw.role,
  medianEntryInning: raw.median_entry_inning,
  altitudeTax:
    raw.altitude_tax_significant &&
    raw.altitude_tax_runs_per_9 !== null &&
    raw.altitude_tax_se !== null
      ? { value: raw.altitude_tax_runs_per_9, se: raw.altitude_tax_se }
      : null,
  meanIvbLossIn: raw.mean_ivb_loss_in,
  altitudeTrap: raw.altitude_trap,
  arsenal: raw.arsenal.map(toArsenalEntry),
})

export const toSeasonEntry = (raw: z.infer<typeof seasonEntrySchema>): SeasonEntry => ({
  season: raw.season,
  nPitchesHh: raw.n_pitches_hh,
  nPitchesSea: raw.n_pitches_sea,
  scored: raw.scored,
})

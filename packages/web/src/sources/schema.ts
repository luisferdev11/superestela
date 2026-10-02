import { z } from 'zod'
import { MIN_PITCHES_FOR_SCORE, ROLES } from '@/domain/constants'

/**
 * El gemelo en TypeScript de `packages/contracts/schemas.py`. `CONVENTIONS.md`
 * seccion 4, regla 3 exige Zod en la frontera: los tipos no protegen de un
 * archivo que cambio de forma.
 *
 * Es `strict()` a proposito. Si `analysis/evidence.py` agrega, quita o renombra
 * un campo, esto falla aqui — con nombre de campo — y no tres componentes mas
 * abajo con un `undefined`.
 */

const STUFF_PLUS_MIN = 40
const STUFF_PLUS_MAX = 160

const stuffPlus = z.number().min(STUFF_PLUS_MIN).max(STUFF_PLUS_MAX)
const band = z.number().nonnegative()

export const arsenalEntrySchema = z
  .object({
    pitch: z.string(),
    usage_pct: z.number(),
    n: z.number().int().nonnegative(),
    velo: z.number().nullable(),
    ivb_hh: z.number().nullable(),
    ivb_sea: z.number().nullable(),
    hb_hh: z.number().nullable(),
    hb_sea: z.number().nullable(),
    spin: z.number().nullable(),
    extension: z.number().nullable(),
    stuff_plus_hh: z.number().nullable(),
    stuff_plus_sea: z.number().nullable(),
    stuff_plus_hh_ci95: band.nullable(),
    stuff_plus_sea_ci95: band.nullable(),
    whiff_per_swing: z.number().nullable(),
  })
  .strict()

const percent = z.number().min(-100).max(100)

/** K%, BB%, K-BB% y whiff por swing, en porcentaje y con su banda al 95%. `null` debajo del minimo. */
export const outcomesSchema = z
  .object({
    pa: z.number().int().nonnegative(),
    swings: z.number().int().nonnegative(),
    k_pct: percent.nullable(),
    k_pct_ci95: band.nullable(),
    bb_pct: percent.nullable(),
    bb_pct_ci95: band.nullable(),
    k_minus_bb_pct: percent.nullable(),
    k_minus_bb_pct_ci95: band.nullable(),
    whiff_per_swing: percent.nullable(),
    whiff_per_swing_ci95: band.nullable(),
  })
  .strict()

export const pitcherCardSchema = z
  .object({
    pitcher_id: z.string(),
    season: z.number().int().min(2000).max(2100),
    throws: z.string(),
    n_pitches_hh: z.number().int().min(MIN_PITCHES_FOR_SCORE),
    n_pitches_sea: z.number().int().min(MIN_PITCHES_FOR_SCORE),
    stuff_plus_hh: stuffPlus,
    stuff_plus_sea: stuffPlus,
    stuff_plus_delta: z.number(),
    stuff_plus_hh_ci95: band,
    stuff_plus_sea_ci95: band,
    role: z.enum(ROLES).nullable(),
    median_entry_inning: z.number().min(1).max(20).nullable(),
    altitude_tax_runs_per_9: z.number().nullable(),
    altitude_tax_se: z.number().positive().nullable(),
    altitude_tax_significant: z.boolean(),
    mean_ivb_loss_in: z.number().nullable(),
    outcomes: outcomesSchema,
    arsenal: z.array(arsenalEntrySchema),
    altitude_trap: z.boolean(),
  })
  .strict()

export const seasonEntrySchema = z
  .object({
    season: z.number().int().min(2000).max(2100),
    n_pitches_hh: z.number().int().nonnegative(),
    n_pitches_sea: z.number().int().nonnegative(),
    scored: z.boolean(),
    outcomes_hh: outcomesSchema,
    outcomes_sea: outcomesSchema,
  })
  .strict()

export const densityLevelSchema = z
  .object({
    n: z.number().int().nonnegative(),
    density_ratio: z.number().min(0.7).max(1.05),
    magnus_ratio: z.number().min(0.7).max(1.05),
    per_game_mean: z.number(),
    per_game_sd: z.number().nonnegative(),
    per_game_n: z.number().int().nonnegative(),
  })
  .strict()

export const scaleSchema = z
  .object({ kind: z.enum(['league', 'per_environment']), description: z.string() })
  .strict()

export const mockupDataSchema = z
  .object({
    scale: scaleSchema,
    pitchers: z.array(pitcherCardSchema),
    pitcher_seasons: z.record(z.string(), z.array(seasonEntrySchema)),
    pitch_profiles: z.record(z.string(), z.unknown()),
    density: z.record(z.string(), densityLevelSchema),
  })
  .strict()

export type PitcherCardRaw = z.infer<typeof pitcherCardSchema>
export type MockupData = z.infer<typeof mockupDataSchema>

/**
 * La forma promedio de la liga por tipo y entorno, de `pitch_profiles`. En
 * `mockupDataSchema` ese campo es `unknown` porque trae muchas mas metricas;
 * aqui se leen solo las dos que dibuja el mapa de la Ficha, sin exigir el resto.
 */
export const leagueShapesSchema = z.record(
  z.string(),
  z.object({
    levels: z.record(z.string(), z.object({ ivb: z.number(), abs_hb: z.number() })),
  }),
)

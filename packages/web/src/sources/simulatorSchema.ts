import { z } from 'zod'
import { PITCH_TYPES } from '@/domain/simulator'

/**
 * Los tres artefactos del Simulador, del lado de la app. No son `strict()`: se
 * leen las llaves que la pantalla usa, y el equipo de datos puede agregar otras
 * sin romperla. Lo que si se exige es la forma de lo que se lee.
 */

const pitchType = z.enum(PITCH_TYPES)
const quantiles = z.object({ p5: z.number(), p50: z.number(), p95: z.number() })
const environments = ['No Altitude', 'Extreme Altitude'] as const

const distribution = z.object({
  n: z.number().int(),
  release_speed: quantiles,
  ivb: quantiles,
  horizontal_break: quantiles,
  spin_rate: quantiles,
  spin_axis: quantiles,
  extension: quantiles,
  release_height: quantiles,
  release_side: quantiles,
})

const extreme = z.object({
  pitcher_id: z.string(),
  season: z.number().int(),
  tier: z.enum(['most', 'least']),
  ivb: z.number(),
  horizontal_break: z.number(),
  swings: z.number().int(),
  whiff_per_swing: z.number(),
})

const mapPanel = z.object({
  bin_in: z.number().positive(),
  min_swings: z.number().int(),
  mean_whiff_per_swing: z.number(),
  cells: z.array(
    z.object({
      ivb: z.number(),
      horizontal_break: z.number(),
      n: z.number().int(),
      swings: z.number().int(),
      whiff_per_swing: z.number(),
    }),
  ),
  extremes: z.object({
    n_ranked: z.number().int(),
    most: z.array(extreme),
    least: z.array(extreme),
  }),
})

const byEnvironment = <T extends z.ZodType>(schema: T) =>
  z.object({ 'No Altitude': schema, 'Extreme Altitude': schema })

export const simulatorEvidenceSchema = z.object({
  distributions: z.record(pitchType, byEnvironment(distribution)),
  movement_map: z.record(pitchType, byEnvironment(mapPanel)),
})

const arsenalPitch = z.object({
  pitch_type: pitchType,
  n: z.number().int(),
  usage: z.number(),
  release_speed: z.number(),
  ivb: z.number(),
  horizontal_break: z.number(),
  spin_rate: z.number(),
  spin_axis: z.number(),
  extension: z.number(),
  release_height: z.number(),
  release_side: z.number(),
  whiff_per_swing: z.number().nullable(),
})

export const arsenalsSchema = z.record(
  z.string(),
  z.object({
    pitcher_id: z.string(),
    season: z.number().int(),
    pitcher_hand: z.enum(['Right', 'Left']),
    by_environment: z.partialRecord(z.enum(environments), z.array(arsenalPitch)),
  }),
)

export const validationSchema = z.object({
  model_id: z.string(),
  uses_arsenal: z.boolean(),
  display_gates: z.array(z.string()),
  stuff_plus_shown: z.boolean(),
  gates: z.array(z.object({ id: z.string(), name: z.string(), passed: z.boolean() })),
})

export type SimulatorEvidenceRaw = z.infer<typeof simulatorEvidenceSchema>
export type ArsenalsRaw = z.infer<typeof arsenalsSchema>

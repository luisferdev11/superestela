import { z } from 'zod'
import { HANDS } from '@/domain/simulator'
import { STUFF_PLUS_REASONS } from './simulateResponse'

/**
 * La respuesta de `POST /api/v1/arsenals/score`, validada en la frontera
 * (`CONVENTIONS.md` seccion 4, regla 3): cada lanzador de un archivo, con su
 * Stuff+ en los dos aires, el Impuesto proyectado y el whiff de su liga.
 */

const metric = z.object({ value: z.number(), se: z.number().nonnegative() })

const pitcher = z.object({
  pitcherId: z.string(),
  pitcherHand: z.enum(HANDS),
  n: z.number().int().positive(),
  stuffPlusSea: metric.nullable(),
  stuffPlusHh: metric.nullable(),
  altitudeDelta: metric.nullable(),
  projectedTax: metric.nullable(),
  whiffPerSwing: z.object({ value: z.number(), ci95: z.number().nonnegative() }).nullable(),
  swings: z.number().int().nonnegative(),
})

export const arsenalScoresSchema = z.object({
  modelId: z.string().nullable(),
  stuffPlusShown: z.boolean(),
  stuffPlusReason: z.enum(STUFF_PLUS_REASONS).nullable(),
  nRows: z.number().int().nonnegative(),
  pitchers: z.array(pitcher),
  fewPitches: z.number().int().nonnegative(),
  minPitches: z.number().int().positive(),
  unsupportedRows: z.number().int().nonnegative(),
  missingFeatureRows: z.number().int().nonnegative(),
  hasSwings: z.boolean(),
  taxValidation: z
    .object({
      n: z.number().int(),
      pearsonR: z.number(),
      meanProjected: z.number(),
      meanMeasured: z.number(),
    })
    .nullable(),
})

export type ArsenalScores = z.infer<typeof arsenalScoresSchema>
export type PitcherScore = ArsenalScores['pitchers'][number]

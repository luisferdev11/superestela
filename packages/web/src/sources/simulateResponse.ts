import { z } from 'zod'
import { PITCH_TYPES } from '@/domain/simulator'
import { toBand95 } from '@/domain/band'

/**
 * La respuesta de `POST /api/v1/simulate`, validada en la frontera
 * (`CONVENTIONS.md` seccion 4, regla 3). Si la API cambia de forma, la pantalla
 * muestra el estado de error en vez de dibujar numeros a medias.
 */

/**
 * The API sends a standard error; the screens show the 95% half-width, the one
 * «±» convention (`docs/12` §2.1). The conversion happens here, once.
 */
const metric = z.object({ value: z.number(), se: z.number().nonnegative() }).transform(toBand95)

const differentials = z.object({
  releaseSpeed: z.number(),
  ivb: z.number(),
  horizontalBreak: z.number(),
  releaseDistance: z.number(),
})

const environment = z.object({
  environment: z.enum(['sea', 'harpHelu']),
  densityIndex: z.number(),
  shape: z.object({ ivb: metric, horizontalBreak: metric }),
  approach: z.object({ plateSpeed: z.number(), vaa: z.number() }),
  stuffPlus: metric.nullable(),
  differentials: differentials.nullable(),
  comparables: z.array(
    z.object({
      pitcherId: z.string(),
      season: z.number().int(),
      n: z.number().int(),
      ivb: z.number(),
      horizontalBreak: z.number(),
      releaseSpeed: z.number(),
      whiffPerSwing: z.number().nullable(),
    }),
  ),
})

export const STUFF_PLUS_REASONS = ['model_unavailable', 'model_not_gated', 'gates_failed'] as const
export type StuffPlusReason = (typeof STUFF_PLUS_REASONS)[number]

export const simulateResponseSchema = z.object({
  modelId: z.string().nullable(),
  usesArsenal: z.boolean(),
  stuffPlusShown: z.boolean(),
  stuffPlusReason: z.enum(STUFF_PLUS_REASONS).nullable(),
  sea: environment,
  harpHelu: environment,
  altitudeDelta: z.object({ total: metric, shape: metric, environment: metric }).nullable(),
  primaryFastball: z.enum(PITCH_TYPES).nullable(),
  plausibility: z.object({
    isPlausible: z.boolean(),
    squaredDistance: z.number(),
    threshold: z.number(),
    unusual: z.array(z.string()),
  }),
  movementPerKrpm: z.object({ value: z.number(), percentile: z.number() }),
})

export type SimulateResponse = z.infer<typeof simulateResponseSchema>
export type EnvironmentResult = SimulateResponse['sea']

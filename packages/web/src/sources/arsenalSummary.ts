import { z } from 'zod'
import { HANDS, PITCH_TYPES } from '@/domain/simulator'
import { FILE_PROBLEMS } from '@/domain/translator'

/**
 * La respuesta de `POST /api/v1/arsenals/summarize`, validada en la frontera
 * (`CONVENTIONS.md` seccion 4, regla 3): un archivo de TrackMan resumido en una
 * fila por tipo de pitch, del lado del brazo, y lo que no se pudo usar.
 */

const pitch = z.object({
  pitchType: z.enum(PITCH_TYPES),
  n: z.number().int().positive(),
  usage: z.number().min(0).max(1),
  releaseSpeed: z.number(),
  ivb: z.number(),
  horizontalBreak: z.number(),
  spinRate: z.number(),
  spinAxis: z.number(),
  extension: z.number(),
  releaseHeight: z.number(),
  releaseSide: z.number(),
})

export const arsenalSummarySchema = z.object({
  pitcherHand: z.enum(HANDS),
  origin: z.enum(['sea', 'medium']).nullable(),
  isMeasuredAtExtreme: z.boolean(),
  nRows: z.number().int().nonnegative(),
  pitches: z.array(pitch),
  unsupportedRows: z.number().int().nonnegative(),
  missingFeatureRows: z.number().int().nonnegative(),
  unsupportedTypes: z.array(z.string()),
  omittedTypes: z.array(z.string()),
})

export type ArsenalSummary = z.infer<typeof arsenalSummarySchema>

export const fileProblemSchema = z.object({
  error: z.enum(FILE_PROBLEMS),
  columns: z.array(z.string()),
})

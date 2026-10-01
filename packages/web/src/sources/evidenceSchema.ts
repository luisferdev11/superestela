import { z } from 'zod'

/**
 * Solo lo que la interfaz necesita de `evidence.json`. No es `strict()` como el
 * de `mockup_data.json`: ese archivo lo consume la app entera y su forma es el
 * contrato; de este se leen dos cifras para la barra de densidad y el pie, y
 * exigir que el resto no cambie seria pedirle al equipo de datos que no agregue
 * metricas.
 */
import { outcomesSchema } from './schema'

export const evidenceSchema = z.object({
  league_outcomes: z.record(z.string(), outcomesSchema),
  audit: z.object({
    n_pitches: z.number().int().positive(),
    seasons: z.array(z.number().int()),
  }),
  seasons: z.object({
    pitchers_with_a_gap: z.number().int().nonnegative(),
  }),
})

export type EvidenceRaw = z.infer<typeof evidenceSchema>

import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { pitcherRunsPath } from './paths'
import type { Metric } from '@/domain/types'

/**
 * Las carreras permitidas por 9 entradas de cada lanzador-temporada, en cada
 * entorno (`analysis/pitcher_runs.py`). La Ficha pidio la ERA; el dataset no
 * marca carreras limpias, asi que esto es RA/9 y se dice asi.
 *
 * No es estricto a proposito: es un artefacto nuevo y puede crecer sin romper
 * la pantalla (`docs/11` §6.1).
 */
const environment = z
  .object({
    ra9: z.number().nonnegative(),
    ra9_ci95: z.number().nonnegative(),
    innings: z.number().nonnegative(),
    runs: z.number().int().nonnegative(),
  })
  .nullable()

const runsSchema = z.object({
  min_innings: z.number(),
  pitchers: z.record(z.string(), z.object({ sea: environment, hh: environment })),
})

/** RA/9 con su banda al 95% y las entradas que lo sostienen; `null` es muestra insuficiente. */
export type RunsAllowed = { readonly ra9: Metric; readonly innings: number } | null

export type PitcherRuns = { readonly sea: RunsAllowed; readonly hh: RunsAllowed }

const toRuns = (raw: z.infer<typeof environment>): RunsAllowed =>
  raw === null ? null : { ra9: { value: raw.ra9, se: raw.ra9_ci95 }, innings: raw.innings }

/** `null` si el archivo no existe: la Ficha simplemente no muestra el RA/9. */
export const loadPitcherRuns = async (): Promise<{
  readonly minInnings: number
  readonly byKey: ReadonlyMap<string, PitcherRuns>
} | null> => {
  let text: string
  try {
    text = await readFile(pitcherRunsPath(), 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
  const parsed = runsSchema.parse(JSON.parse(text) as unknown)
  return {
    minInnings: parsed.min_innings,
    byKey: new Map(
      Object.entries(parsed.pitchers).map(([key, v]) => [
        key,
        { sea: toRuns(v.sea), hh: toRuns(v.hh) },
      ]),
    ),
  }
}

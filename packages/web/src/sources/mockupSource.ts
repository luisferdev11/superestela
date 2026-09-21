import 'server-only'
import { readFile } from 'node:fs/promises'
import { evidencePath, mockupDataPath } from './paths'
import { mockupDataSchema } from './schema'
import { evidenceSchema } from './evidenceSchema'
import { toDensityLevel, toPitcherSeason, toSeasonEntry } from './adapter'
import { orderByDensity, type DensityScale } from '@/domain/density'
import type { PitcherSeason, SeasonEntry } from '@/domain/types'

/**
 * `server-only` no es decorativo: son 727 KB. Si un componente cliente llega a
 * importar esto, el build falla — que es mejor que descubrirlo en la revision.
 */

export type Dataset = {
  readonly cards: readonly PitcherSeason[]
  readonly seasonsByPitcher: ReadonlyMap<string, readonly SeasonEntry[]>
  readonly density: DensityScale
  /** Del audit: lo que respalda el pie del rail. */
  readonly nPitches: number
  readonly seasons: readonly number[]
}

export const loadDataset = async (): Promise<Dataset> => {
  const [mockupRaw, evidenceRaw]: [unknown, unknown] = await Promise.all([
    readFile(mockupDataPath(), 'utf8').then((text): unknown => JSON.parse(text)),
    readFile(evidencePath(), 'utf8').then((text): unknown => JSON.parse(text)),
  ])
  const parsed = mockupDataSchema.parse(mockupRaw)
  const evidence = evidenceSchema.parse(evidenceRaw)

  // Cual entorno es "nivel del mar" y cual "altitud extrema" se decide por la
  // densidad medida, no por la ortografia de la etiqueta.
  const levels = orderByDensity(
    Object.entries(parsed.density).map(([label, level]) => toDensityLevel(label, level)),
  )
  const sea = levels[0]
  const extreme = levels[levels.length - 1]
  if (sea === undefined || extreme === undefined) {
    throw new Error('mockup_data.json no trae ningun entorno con densidad medida')
  }

  return {
    cards: parsed.pitchers.map(toPitcherSeason),
    seasonsByPitcher: new Map(
      Object.entries(parsed.pitcher_seasons).map(([pitcherId, seasons]) => [
        pitcherId,
        seasons.map(toSeasonEntry),
      ]),
    ),
    density: { levels, sea, extreme },
    nPitches: evidence.audit.n_pitches,
    seasons: evidence.audit.seasons,
  }
}

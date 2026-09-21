import 'server-only'
import { readFile } from 'node:fs/promises'
import { mockupDataPath } from './paths'
import { mockupDataSchema } from './schema'
import { toPitcherSeason, toSeasonEntry } from './adapter'
import type { PitcherSeason, SeasonEntry } from '@/domain/types'

/**
 * `server-only` no es decorativo: son 727 KB. Si un componente cliente llega a
 * importar esto, el build falla — que es mejor que descubrirlo en la revision.
 */

export type Dataset = {
  readonly cards: readonly PitcherSeason[]
  readonly seasonsByPitcher: ReadonlyMap<string, readonly SeasonEntry[]>
}

export const loadDataset = async (): Promise<Dataset> => {
  const raw: unknown = JSON.parse(await readFile(mockupDataPath(), 'utf8'))
  const parsed = mockupDataSchema.parse(raw)

  return {
    cards: parsed.pitchers.map(toPitcherSeason),
    seasonsByPitcher: new Map(
      Object.entries(parsed.pitcher_seasons).map(([pitcherId, seasons]) => [
        pitcherId,
        seasons.map(toSeasonEntry),
      ]),
    ),
  }
}

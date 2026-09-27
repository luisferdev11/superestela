import 'server-only'
import { readFile } from 'node:fs/promises'
import { arsenalsPath, simulatorEvidencePath, simulatorValidationPath } from './paths'
import { arsenalsSchema, simulatorEvidenceSchema, validationSchema } from './simulatorSchema'
import type { ArsenalsRaw, SimulatorEvidenceRaw } from './simulatorSchema'
import {
  PITCH_TYPES,
  type ArsenalPitch,
  type Control,
  type Distributions,
  type PitchType,
  type PitcherArsenal,
  type Quantiles,
} from '@/domain/simulator'
import type { MovementMaps, MapPanel } from '@/domain/movementMap'

/**
 * Lo que la pagina del Simulador lee en el servidor. El score no: ese lo pide
 * el cliente a la API, porque cambia con cada slider. Aqui va lo fijo —rangos,
 * el mapa observado, los arsenales y el veredicto de las compuertas— y el
 * `snake_case` se vuelve `camelCase` en un solo lugar, como en `adapter.ts`.
 */

const SEA = 'No Altitude'
const EXT = 'Extreme Altitude'

const CONTROL_KEYS: Readonly<
  Record<Control, keyof SimulatorEvidenceRaw['distributions'][PitchType]['No Altitude']>
> = {
  releaseSpeed: 'release_speed',
  ivb: 'ivb',
  horizontalBreak: 'horizontal_break',
  extension: 'extension',
  releaseHeight: 'release_height',
  releaseSide: 'release_side',
  spinRate: 'spin_rate',
  spinAxis: 'spin_axis',
}

export type Validation = {
  readonly modelId: string
  readonly usesArsenal: boolean
  readonly stuffPlusShown: boolean
  readonly passed: number
  readonly total: number
  readonly failed: readonly string[]
}

export type SimulatorDataset = {
  readonly distributions: Distributions
  readonly maps: MovementMaps
  readonly arsenals: readonly PitcherArsenal[]
  readonly validation: Validation | null
}

const readJson = async (file: string): Promise<unknown> =>
  JSON.parse(await readFile(file, 'utf8')) as unknown

const toDistributions = (raw: SimulatorEvidenceRaw): Distributions =>
  Object.fromEntries(
    PITCH_TYPES.map((pt) => [
      pt,
      Object.fromEntries(
        Object.entries(CONTROL_KEYS).map(([control, key]) => [
          control,
          raw.distributions[pt][SEA][key] as Quantiles,
        ]),
      ),
    ]),
  ) as unknown as Distributions

const toPanel = (
  raw: SimulatorEvidenceRaw['movement_map'][PitchType]['No Altitude'],
): MapPanel => ({
  binIn: raw.bin_in,
  meanWhiffPerSwing: raw.mean_whiff_per_swing,
  cells: raw.cells.map((c) => ({
    ivb: c.ivb,
    horizontalBreak: c.horizontal_break,
    swings: c.swings,
    whiffPerSwing: c.whiff_per_swing,
  })),
  extremes: [...raw.extremes.most, ...raw.extremes.least].map((e) => ({
    pitcherId: e.pitcher_id,
    season: e.season,
    tier: e.tier,
    ivb: e.ivb,
    horizontalBreak: e.horizontal_break,
    whiffPerSwing: e.whiff_per_swing,
  })),
})

const toArsenals = (raw: ArsenalsRaw): PitcherArsenal[] =>
  Object.entries(raw)
    .map(([key, rec]) => ({
      key,
      pitcherId: rec.pitcher_id,
      season: rec.season,
      hand: rec.pitcher_hand,
      sea: (rec.by_environment[SEA] ?? []).map(
        (p): ArsenalPitch => ({
          pitchType: p.pitch_type,
          usage: p.usage,
          n: p.n,
          whiffPerSwing: p.whiff_per_swing,
          releaseSpeed: p.release_speed,
          ivb: p.ivb,
          horizontalBreak: p.horizontal_break,
          extension: p.extension,
          releaseHeight: p.release_height,
          releaseSide: p.release_side,
          spinRate: p.spin_rate,
          spinAxis: p.spin_axis,
        }),
      ),
    }))
    // Sin forma a nivel del mar no hay de donde partir: el Simulador la toma de entrada.
    .filter((a) => a.sea.length > 0)
    .sort((a, b) => a.pitcherId.localeCompare(b.pitcherId) || b.season - a.season)

export const loadSimulatorDataset = async (): Promise<SimulatorDataset> => {
  const [evidenceRaw, arsenalsRaw, validationRaw] = await Promise.all([
    readJson(simulatorEvidencePath()),
    readJson(arsenalsPath()),
    // Sin veredicto no hay Stuff+ en pantalla, pero el resto del Simulador sigue.
    readJson(simulatorValidationPath()).catch((): null => null),
  ])
  const evidence = simulatorEvidenceSchema.parse(evidenceRaw)
  const validation = validationRaw === null ? null : validationSchema.parse(validationRaw)
  return {
    distributions: toDistributions(evidence),
    maps: Object.fromEntries(
      PITCH_TYPES.map((pt) => [
        pt,
        {
          sea: toPanel(evidence.movement_map[pt][SEA]),
          hh: toPanel(evidence.movement_map[pt][EXT]),
        },
      ]),
    ) as unknown as MovementMaps,
    arsenals: toArsenals(arsenalsSchema.parse(arsenalsRaw)),
    validation:
      validation === null
        ? null
        : {
            modelId: validation.model_id,
            usesArsenal: validation.uses_arsenal,
            stuffPlusShown: validation.stuff_plus_shown,
            passed: validation.gates.filter((g) => g.passed).length,
            total: validation.gates.length,
            failed: validation.gates.filter((g) => !g.passed).map((g) => g.id),
          },
  }
}

import type { UsageShift } from './plan'
import type { Metric } from './types'

/**
 * The bridge from Stuff+ to runs: what a model whose scale is set per pitch
 * type says a Stuff+ point is worth. Stuff+ = 100 - 10 (xRV - mean) / sd, so a
 * pitch's expected run value is mean + (100 - Stuff+) / 10 * sd, in runs per
 * pitch. v0 has no per-type scale and no bridge (`docs/15`).
 */
export type RunBridge = {
  readonly modelId: string
  /** `[mean, sd]` of the xRV per pitch, per pitch type. */
  readonly xrvByType: Readonly<Record<string, readonly [number, number]>>
  /** Measured in extreme altitude (`evidence.json → run_environment`). */
  readonly pitchesPerInning: number
}

const INNINGS = 9

/** Runs per pitch a Stuff+ stands for, with its 95% band carried through the scale. */
export const xrvOf = (bridge: RunBridge, pitch: string, stuff: Metric): Metric | null => {
  const scale = bridge.xrvByType[pitch]
  if (scale === undefined) return null
  const [mean, sd] = scale
  return { value: mean + ((100 - stuff.value) / 10) * sd, se: (stuff.se / 10) * sd }
}

/**
 * Runs per 9 innings in extreme altitude that a usage shift saves (negative)
 * or costs. Each moved pitch is worth its own type's xRV, so the answer holds
 * across types, which a Stuff+ point does not. Bands add in quadrature, as
 * if the two pitches were independent; the screen says so.
 */
export const runsOfShift = (
  bridge: RunBridge,
  shift: UsageShift,
  stuffHh: ReadonlyMap<string, Metric>,
): Metric | null => {
  const from = stuffHh.get(shift.from)
  const to = stuffHh.get(shift.to)
  if (from === undefined || to === undefined) return null
  const a = xrvOf(bridge, shift.from, from)
  const b = xrvOf(bridge, shift.to, to)
  if (a === null || b === null) return null
  const share = shift.points / 100
  const perNine = bridge.pitchesPerInning * INNINGS * share
  return {
    value: perNine * (b.value - a.value),
    se: perNine * Math.sqrt(a.se ** 2 + b.se ** 2),
  }
}

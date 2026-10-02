import { arsenalRows } from './arsenal'
import { pitchDeltas, type PitchDelta } from './reading'
import type { Metric, PitcherSeason } from './types'

/**
 * El Plan de Desarrollo (P5, `docs/02`): que se degrada, que aguanta y que
 * reparto de uso lo compensa. **Solo Stuff+, nunca carreras**: el puente
 * Stuff+ → carreras no existe todavia (A3). Todo es aritmetica sobre las cifras
 * por pitch de la tarjeta; no hay modelo nuevo.
 *
 * Supuesto de las bandas: los pitches son muestras distintas, asi que sus
 * errores se suman en cuadratura.
 */

/** 100 es el promedio de la escala de v0 (`docs/adr/0007`). */
const AVERAGE = 100

/** Un pitch que carga con mas de esta parte del deficit lo carga «solo». */
export const SINGLE_PITCH_SHARE = 0.8

export type Contribution = {
  readonly pitch: string
  /** Entre 0 y 1: el uso en altitud extrema. */
  readonly share: number
  readonly stuffPlusHh: Metric
  /** Uso × (Stuff+ en altitud extrema − 100): cuanto aporta al deficit (negativo) o al superavit. */
  readonly contribution: Metric
}

const sumMetrics = (metrics: readonly Metric[]): Metric => ({
  value: metrics.reduce((s, m) => s + m.value, 0),
  se: Math.hypot(...metrics.map((m) => m.se)),
})

export const contributions = (card: PitcherSeason): readonly Contribution[] =>
  arsenalRows(card).flatMap((row) => {
    if (row.stuffPlusHh === null) return []
    const share = row.usagePct / 100
    return [
      {
        pitch: row.pitch,
        share,
        stuffPlusHh: row.stuffPlusHh,
        contribution: {
          value: share * (row.stuffPlusHh.value - AVERAGE),
          se: share * row.stuffPlusHh.se,
        },
      },
    ]
  })

/** El deficit total contra 100, con su banda. */
export const deficitOf = (items: readonly Contribution[]): Metric =>
  sumMetrics(items.map((c) => c.contribution))

/** El pitch que carga con casi todo el deficit, si lo hay. */
export const singleCulprit = (items: readonly Contribution[]): Contribution | null => {
  const negative = items.filter((c) => c.contribution.value < 0)
  const total = negative.reduce((s, c) => s + c.contribution.value, 0)
  if (total >= 0) return null
  const worst = [...negative].sort((a, b) => a.contribution.value - b.contribution.value)[0]
  return worst !== undefined && worst.contribution.value / total >= SINGLE_PITCH_SHARE
    ? worst
    : null
}

/** Stuff+ en altitud extrema del arsenal ponderado por uso, sobre los pitches que tienen score. */
export const weightedStuffPlus = (
  items: readonly Contribution[],
  shares: ReadonlyMap<string, number>,
): Metric => {
  const weights = items.map((c) => shares.get(c.pitch) ?? 0)
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return { value: Number.NaN, se: Number.NaN }
  return {
    value: items.reduce((s, c, i) => s + (weights[i] ?? 0) * c.stuffPlusHh.value, 0) / total,
    se: Math.hypot(...items.map((c, i) => (weights[i] ?? 0) * c.stuffPlusHh.se)) / total,
  }
}

export type ShapeLoss = PitchDelta & {
  readonly ivbSea: number | null
  readonly ivbHh: number | null
}

export type UsageShift = {
  readonly from: string
  readonly to: string
  /** Puntos porcentuales que se mueven, ya recortados a lo que el pitch tiene. */
  readonly points: number
  readonly shares: ReadonlyMap<string, number>
  readonly before: Metric
  readonly after: Metric
}

export type Plan = {
  readonly degrades: ShapeLoss
  readonly holds: ShapeLoss
  readonly deficit: Metric
  readonly culprit: Contribution | null
  readonly contributions: readonly Contribution[]
}

/**
 * `null` si no hay dos pitches con score en los dos entornos: sin algo que se
 * degrade y algo que aguante, no hay plan que proponer.
 */
export const planOf = (card: PitcherSeason): Plan | null => {
  const rows = arsenalRows(card)
  const withShape = (d: PitchDelta): ShapeLoss => {
    const row = rows.find((r) => r.pitch === d.pitch)
    return { ...d, ivbSea: row?.ivbSea ?? null, ivbHh: row?.ivbHh ?? null }
  }
  const byDelta = [...pitchDeltas(card)].sort((a, b) => a.delta.value - b.delta.value)
  const worst = byDelta[0]
  const best = byDelta[byDelta.length - 1]
  if (worst === undefined || best === undefined || worst.pitch === best.pitch) return null
  const items = contributions(card)
  return {
    degrades: withShape(worst),
    holds: withShape(best),
    deficit: deficitOf(items),
    culprit: singleCulprit(items),
    contributions: items,
  }
}

/**
 * Mover `points` puntos de uso del pitch que se degrada al que aguanta. Nunca
 * deja un uso negativo, nunca inventa un pitch, y el total no cambia.
 */
export const shiftUsage = (plan: Plan, points: number): UsageShift => {
  const current = new Map(plan.contributions.map((c) => [c.pitch, c.share]))
  const available = current.get(plan.degrades.pitch) ?? 0
  const moved = Math.max(0, Math.min(points / 100, available))
  const shares = new Map(current)
  shares.set(plan.degrades.pitch, available - moved)
  shares.set(plan.holds.pitch, (current.get(plan.holds.pitch) ?? 0) + moved)
  return {
    from: plan.degrades.pitch,
    to: plan.holds.pitch,
    points: 100 * moved,
    shares,
    before: weightedStuffPlus(plan.contributions, current),
    after: weightedStuffPlus(plan.contributions, shares),
  }
}

/** Los pasos que ofrece la pantalla, en puntos de uso. */
export const SHIFT_STEPS = [10, 20, 30] as const
export const DEFAULT_SHIFT = 20

/**
 * Pasarle uso al que aguanta solo compensa si ademas rinde mas en altura. Si
 * el que menos pierde sigue por debajo del que mas pierde, mover uso empeora
 * el arsenal, y la pantalla lo dice en vez de proponerlo.
 */
export const shiftHelps = (plan: Plan): boolean => {
  const hh = (pitch: string): number =>
    plan.contributions.find((c) => c.pitch === pitch)?.stuffPlusHh.value ?? Number.NaN
  return hh(plan.holds.pitch) > hh(plan.degrades.pitch)
}

import { MIN_PITCHES_FOR_BASELINE } from './simulator'
import type { Metric } from './types'

/**
 * La Proyeccion (P7, `docs/10` T6): la forma medida de un lanzador a nivel del
 * mar, movida a otro entorno con la misma ley que usa la API
 * (`core.translate`). Aqui no se calcula fisica: la trae `projections.json`.
 * Aqui se decide que se compara y como se lee.
 */
export type Target = 'medium' | 'hh'

export const TARGETS: readonly Target[] = ['hh', 'medium']

export type Shape = { readonly ivb: number; readonly horizontalBreak: number }

export type ProjectedPitch = {
  readonly pitchType: string
  readonly n: number
  readonly usage: number
  readonly sea: Shape
  readonly projected: Readonly<
    Record<Target, { readonly ivb: Metric; readonly horizontalBreak: Metric }>
  >
  /** Solo la altitud extrema se mide por lanzador; la media no. */
  readonly measuredHh: (Shape & { readonly n: number }) | null
}

export type PitcherProjection = {
  readonly key: string
  readonly pitcherId: string
  readonly season: number
  readonly pitches: readonly ProjectedPitch[]
}

export type Projections = {
  readonly densities: Readonly<Record<Target | 'sea', number>>
  readonly factors: Readonly<Record<Target, number>>
  readonly pitchers: ReadonlyMap<string, PitcherProjection>
}

/** 1.96 errores estandar: la banda al 95% con la que se compara lo medido. */
const Z95 = 1.96

/** Los pitches que se proyectan: los que tienen muestra a nivel del mar para partir. */
export const projectedPitches = (p: PitcherProjection): readonly ProjectedPitch[] =>
  p.pitches.filter((x) => x.n >= MIN_PITCHES_FOR_BASELINE).sort((a, b) => b.usage - a.usage)

export type Check = {
  readonly measured: Shape
  readonly ivbInBand: boolean
  readonly horizontalBreakInBand: boolean
}

/** Si lo medido cae dentro de la banda al 95% de lo proyectado. */
export const inBand = (measured: number, projected: Metric): boolean =>
  Math.abs(measured - projected.value) <= Z95 * projected.se

/**
 * Lo medido en altitud extrema contra lo proyectado, eje por eje, solo si hay
 * muestra en altura. Con menos de 30 lanzamientos lo medido es ruido, no un
 * juez de la proyeccion.
 */
export const checkAgainstMeasured = (x: ProjectedPitch): Check | null => {
  const m = x.measuredHh
  if (m === null || m.n < MIN_PITCHES_FOR_BASELINE) return null
  return {
    measured: { ivb: m.ivb, horizontalBreak: m.horizontalBreak },
    ivbInBand: inBand(m.ivb, x.projected.hh.ivb),
    horizontalBreakInBand: inBand(m.horizontalBreak, x.projected.hh.horizontalBreak),
  }
}

/** Cuantos pitches con muestra en altura caen dentro de la banda en los dos ejes. */
export const bandAgreement = (
  p: PitcherProjection,
): { readonly inBand: number; readonly checked: number } => {
  const checks = projectedPitches(p)
    .map(checkAgainstMeasured)
    .filter((c): c is Check => c !== null)
  return {
    inBand: checks.filter((c) => c.ivbInBand && c.horizontalBreakInBand).length,
    checked: checks.length,
  }
}

/** La altitud media se extrapola: la ley y su banda se midieron entre mar y altitud extrema. */
export const isExtrapolation = (target: Target): boolean => target === 'medium'

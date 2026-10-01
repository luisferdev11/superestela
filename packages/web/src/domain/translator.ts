import type { Metric } from './types'
import {
  CONTROLS,
  baselinePitches,
  pickValues,
  type Control,
  type Hand,
  type PitchType,
  type PitchValues,
  type PitcherArsenal,
  type SimulateRequest,
} from './simulator'

/**
 * El Traductor (P3, `docs/10` T2), del lado del dominio: la tabla del arsenal
 * que alguien captura, si es valida, y las preguntas que se le hacen a la API.
 * Ningun score se calcula aqui; el de cada pitch lo da `POST /simulate`, igual
 * que en el Simulador, para que un pitch valga lo mismo en toda la app.
 */

/** Donde se midio el arsenal. Altitud extrema no: la pregunta es por quien nunca lanzo ahi. */
export type Origin = 'sea' | 'medium'

export const ORIGINS: readonly Origin[] = ['sea', 'medium']

/** Desde altitud media la ley se extrapola: se midio entre nivel del mar y altitud extrema. */
export const isExtrapolation = (origin: Origin): boolean => origin === 'medium'

/** Una fila de la tabla: un pitch del arsenal, con su uso de 0 a 1. */
export type TranslatorRow = PitchValues & {
  readonly pitchType: PitchType
  readonly usage: number
}

/** A lo mas un pitch por tipo, como en `arsenals.json`: el arsenal es un reparto. */
export const MAX_ROWS = 6

/**
 * Los limites que la API acepta (`packages/api/schemas.py`, `PitchIn`). Se
 * validan aqui tambien para decir que celda esta mal antes de preguntar; un test
 * los compara contra el archivo de Python.
 */
export const LIMITS: Readonly<Record<Control, { readonly min: number; readonly max: number }>> = {
  releaseSpeed: { min: 55, max: 106 },
  ivb: { min: -30, max: 30 },
  horizontalBreak: { min: -30, max: 30 },
  spinRate: { min: 1, max: 4000 },
  spinAxis: { min: 0, max: 360 },
  extension: { min: 3, max: 9 },
  releaseHeight: { min: 3, max: 8 },
  releaseSide: { min: -5, max: 5 },
}

export type RowProblem = 'outOfRange' | 'badUsage' | 'duplicateType'

/** Que esta mal en cada fila, celda por celda. Vacio: la fila se puede preguntar. */
export type RowCheck = {
  readonly cells: ReadonlySet<Control>
  readonly problems: ReadonlySet<RowProblem>
}

export const checkRows = (rows: readonly TranslatorRow[]): readonly RowCheck[] => {
  const seen = new Map<PitchType, number>()
  for (const r of rows) seen.set(r.pitchType, (seen.get(r.pitchType) ?? 0) + 1)
  return rows.map((r) => {
    const cells = new Set(
      CONTROLS.filter((c) => {
        const v = r[c]
        return !Number.isFinite(v) || v < LIMITS[c].min || v > LIMITS[c].max
      }),
    )
    const problems = new Set<RowProblem>()
    if (cells.size > 0) problems.add('outOfRange')
    // Un uso vacio o fuera de 0-100 no es un reparto: con un NaN, todo el arsenal pesaba cero.
    if (!Number.isFinite(r.usage) || r.usage < 0 || r.usage > 100) problems.add('badUsage')
    if ((seen.get(r.pitchType) ?? 0) > 1) problems.add('duplicateType')
    return { cells, problems }
  })
}

/** Si toda la tabla se puede preguntar: filas validas y algun uso. */
export const isReady = (rows: readonly TranslatorRow[]): boolean =>
  rows.length > 0 &&
  rows.some((r) => r.usage > 0) &&
  checkRows(rows).every((c) => c.problems.size === 0)

/** El uso de cada fila como fraccion del total: el usuario captura porcentajes que no suman 100. */
export const normalizedUsage = (rows: readonly TranslatorRow[]): readonly number[] => {
  const usable = (u: number): number => (Number.isFinite(u) ? Math.max(0, u) : 0)
  const total = rows.reduce((s, r) => s + usable(r.usage), 0)
  return rows.map((r) => (total > 0 ? usable(r.usage) / total : 0))
}

/**
 * Un arsenal real como ejemplo: los pitches con muestra a nivel del mar, del
 * mas usado al menos. Es el boton «cargar ejemplo» de `docs/10` T2.
 */
export const exampleRows = (arsenal: PitcherArsenal): readonly TranslatorRow[] =>
  baselinePitches(arsenal.sea)
    .slice(0, MAX_ROWS)
    .map((p) => ({ ...pickValues(p), pitchType: p.pitchType, usage: p.usage }))

export type TranslatorRequest = SimulateRequest & { readonly originDensityIndex?: number }

/**
 * Una pregunta por pitch, con el arsenal entero de contexto para que los
 * diferenciales se midan contra su recta. `originDensityIndex` le dice a la API
 * donde se midio; ella lo lleva al nivel del mar con la misma ley.
 */
export const translatorRequests = (
  rows: readonly TranslatorRow[],
  hand: Hand,
  originDensityIndex: number,
): readonly TranslatorRequest[] => {
  const shares = normalizedUsage(rows)
  const arsenal = rows.map((r, i) => ({
    pitchType: r.pitchType,
    usage: shares[i] ?? 0,
    releaseSpeed: r.releaseSpeed,
    ivb: r.ivb,
    horizontalBreak: r.horizontalBreak,
    releaseHeight: r.releaseHeight,
    releaseSide: r.releaseSide,
  }))
  // A nivel del mar no se manda el origen: es el default de la API, y asi la
  // pregunta es la misma que la del Simulador.
  const origin = originDensityIndex === 1 ? {} : { originDensityIndex }
  return rows.map((r) => ({
    pitch: { ...pickValues(r), pitchType: r.pitchType, pitcherHand: hand },
    pitcherId: null,
    arsenal,
    ...origin,
  }))
}

/**
 * El Stuff+ del arsenal ponderado por uso, sobre los pitches que tienen score.
 * La banda supone pitches independientes, como el Plan (`domain/plan.ts`):
 * comparten modelo, asi que es optimista, y se dice en pantalla.
 */
export const weightedMetric = (
  values: readonly (Metric | null)[],
  shares: readonly number[],
): Metric | null => {
  const pairs = values.flatMap((v, i) => (v === null ? [] : [{ v, w: shares[i] ?? 0 }]))
  const total = pairs.reduce((s, p) => s + p.w, 0)
  if (total <= 0) return null
  return {
    value: pairs.reduce((s, p) => s + p.w * p.v.value, 0) / total,
    se: Math.hypot(...pairs.map((p) => p.w * p.v.se)) / total,
  }
}

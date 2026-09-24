/**
 * El Simulador, del lado del dominio: que se puede mover, entre que limites, y
 * desde donde se parte. Nada de score aqui — eso vive en la API
 * (`CONVENTIONS.md` seccion 4, regla 6). Fundamento en `docs/09`.
 *
 * Todo lo horizontal va del lado del brazo: positivo hacia el brazo que lanza,
 * igual para diestros y zurdos, como en `analysis/simulator_evidence.py`.
 */

export const PITCH_TYPES = [
  'Four-Seam',
  'Sinker',
  'Cutter',
  'Slider',
  'Curveball',
  'Changeup',
] as const
export type PitchType = (typeof PITCH_TYPES)[number]

export const HANDS = ['Right', 'Left'] as const
export type Hand = (typeof HANDS)[number]

/** Las perillas, en el orden y los grupos de `docs/02` P4: forma, release, spin. */
export const CONTROLS = [
  'releaseSpeed',
  'ivb',
  'horizontalBreak',
  'extension',
  'releaseHeight',
  'releaseSide',
  'spinRate',
  'spinAxis',
] as const
export type Control = (typeof CONTROLS)[number]

export const CONTROL_GROUPS: readonly {
  readonly id: 'shape' | 'release' | 'spin'
  readonly controls: readonly Control[]
}[] = [
  { id: 'shape', controls: ['releaseSpeed', 'ivb', 'horizontalBreak'] },
  { id: 'release', controls: ['extension', 'releaseHeight', 'releaseSide'] },
  { id: 'spin', controls: ['spinRate', 'spinAxis'] },
]

export type PitchValues = Readonly<Record<Control, number>>

/** p5, mediana y p95 de la liga a nivel del mar, por tipo y perilla. */
export type Quantiles = { readonly p5: number; readonly p50: number; readonly p95: number }
export type Distributions = Readonly<Record<PitchType, Readonly<Record<Control, Quantiles>>>>

export type SliderSpec = {
  readonly min: number
  readonly max: number
  readonly step: number
  /** La banda p5-p95 de la liga, que el slider dibuja detras del pulgar. */
  readonly league: Quantiles
}

/** Paso de cada perilla: la resolucion con la que el dato se mide y se lee. */
const STEP: Readonly<Record<Control, number>> = {
  releaseSpeed: 0.1,
  ivb: 0.1,
  horizontalBreak: 0.1,
  extension: 0.05,
  releaseHeight: 0.05,
  releaseSide: 0.05,
  spinRate: 10,
  spinAxis: 1,
}

/**
 * Hasta media banda p5-p95 mas alla de cada extremo. Mas lejos ya no es un
 * pitch que se lance en la LMB, y el aviso de plausibilidad lo diria de todos
 * modos; el slider no tiene por que invitar a ir ahi.
 */
const REACH = 0.5

const roundTo = (value: number, step: number): number => Math.round(value / step) * step

export const sliderSpec = (league: Quantiles, control: Control): SliderSpec => {
  const reach = REACH * (league.p95 - league.p5)
  const step = STEP[control]
  const min = roundTo(league.p5 - reach, step)
  const max = roundTo(league.p95 + reach, step)
  return control === 'spinAxis'
    ? { min: Math.max(0, min), max: Math.min(360, max), step, league }
    : { min, max, step, league }
}

/** El pitch mediano de la liga para el tipo: el punto de partida del laboratorio. */
export const leagueMedian = (distributions: Distributions, pitchType: PitchType): PitchValues => {
  const d = distributions[pitchType]
  return Object.fromEntries(CONTROLS.map((c) => [c, d[c].p50])) as Record<Control, number>
}

/** Un pitch del arsenal real de un lanzador, en un entorno. */
export type ArsenalPitch = PitchValues & {
  readonly pitchType: PitchType
  readonly usage: number
  readonly n: number
  readonly whiffPerSwing: number | null
}

export type PitcherArsenal = {
  readonly key: string
  readonly pitcherId: string
  readonly season: number
  readonly hand: Hand
  /** Nivel del mar: la forma que el Simulador toma como entrada. */
  readonly sea: readonly ArsenalPitch[]
}

/** Lo que se le manda a `POST /api/v1/simulate`. */
export type SimulateRequest = {
  readonly pitch: PitchValues & { readonly pitchType: PitchType; readonly pitcherHand: Hand }
  readonly arsenal: readonly {
    readonly pitchType: PitchType
    readonly usage: number
    readonly releaseSpeed: number
    readonly ivb: number
    readonly horizontalBreak: number
    readonly releaseHeight: number
    readonly releaseSide: number
  }[]
}

/**
 * El pitch que se simula va contra el resto del arsenal de su lanzador. Si se
 * simula el mismo tipo que ya existe, el simulado lo reemplaza: es la pregunta
 * «¿y si su recta fuera asi?», no un pitch nuevo junto a la vieja.
 */
export const buildRequest = (
  values: PitchValues,
  pitchType: PitchType,
  hand: Hand,
  arsenal: readonly ArsenalPitch[],
): SimulateRequest => ({
  pitch: { ...values, pitchType, pitcherHand: hand },
  arsenal: arsenal.map((p) => {
    const v = p.pitchType === pitchType ? values : p
    return {
      pitchType: p.pitchType,
      usage: p.usage,
      releaseSpeed: v.releaseSpeed,
      ivb: v.ivb,
      horizontalBreak: v.horizontalBreak,
      releaseHeight: v.releaseHeight,
      releaseSide: v.releaseSide,
    }
  }),
})

/** Cuanto se movio cada perilla respecto a la linea base. Cero: el pitch real. */
export const changedControls = (values: PitchValues, baseline: PitchValues): Control[] =>
  CONTROLS.filter((c) => Math.abs(values[c] - baseline[c]) > STEP[c] / 2)

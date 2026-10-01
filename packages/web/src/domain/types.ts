import type { ROLES } from './constants'

export type Role = (typeof ROLES)[number]

/**
 * Los dos entornos que el producto compara. `hh` es la categoria `Extreme Altitude`
 * del dataset: cinco parques (Puebla, CDMX, Aguascalientes, Queretaro y Leon), no
 * solo el Harp Helu. El identificador se queda por compatibilidad del contrato.
 */
export type Environment = 'hh' | 'sea'

/**
 * Un numero con su banda. Es un objeto y no dos props sueltas a proposito: asi
 * no existe la forma de pasar el valor sin la incertidumbre.
 * `README`, regla 3: ningun score sin su banda.
 */
export type Metric = {
  readonly value: number
  readonly se: number
}

export type ArsenalEntry = {
  readonly pitch: string
  readonly usagePct: number
  readonly n: number
  readonly velo: number | null
  readonly ivbHh: number | null
  readonly ivbSea: number | null
  readonly hbHh: number | null
  readonly hbSea: number | null
  readonly spin: number | null
  readonly extension: number | null
  /** Con su banda, como el del lanzador: la Ficha lo muestra por pitch. */
  readonly stuffPlusHh: Metric | null
  readonly stuffPlusSea: Metric | null
  readonly whiffPerSwing: number | null
}

/**
 * Una tarjeta del Contrato B: un lanzador en una temporada. La llave es
 * `(pitcherId, season)` — ver `docs/adr/0005`.
 */
/**
 * Lo que Diablos lee primero (Q&A, 30 sep): ponches, bases por bolas y swings
 * abanicados, en porcentaje y con su banda al 95%. Es descriptivo: se cuenta,
 * no se modela. `null` es «muestra insuficiente».
 */
export type Outcomes = {
  readonly plateAppearances: number
  readonly swings: number
  readonly kPct: Metric | null
  readonly bbPct: Metric | null
  readonly kMinusBbPct: Metric | null
  readonly whiffPerSwing: Metric | null
}

export type PitcherSeason = {
  readonly pitcherId: string
  readonly season: number
  readonly throws: string
  readonly nPitchesHh: number
  readonly nPitchesSea: number
  readonly stuffPlusHh: Metric
  readonly stuffPlusSea: Metric
  readonly stuffPlusDelta: number
  readonly role: Role | null
  readonly medianEntryInning: number | null
  /** `null` cuando el impuesto no es significativo: entonces es "no concluyente". */
  readonly altitudeTax: Metric | null
  /**
   * Lo medido, significativo o no. La Ficha dice «no concluyente» y ademas
   * cuanto midio, para que se vea que la banda cruza el cero.
   */
  readonly altitudeTaxMeasured: Metric | null
  readonly meanIvbLossIn: number | null
  readonly altitudeTrap: boolean
  /** Los dos entornos juntos: la temporada completa. */
  readonly outcomes: Outcomes
  readonly arsenal: readonly ArsenalEntry[]
}

/** Una temporada en la trayectoria de un lanzador, haya calificado o no. */
export type SeasonEntry = {
  readonly season: number
  readonly nPitchesHh: number
  readonly nPitchesSea: number
  readonly scored: boolean
  readonly outcomesHh: Outcomes
  readonly outcomesSea: Outcomes
}

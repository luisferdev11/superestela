import { dominantPitch } from './arsenal'
import { sortRows, type SortDirection, type SortState, type SortValue } from './tableSort'
import type { RadarCard } from './cohort'
import type { Environment, Metric, PitcherSeason } from './types'

/**
 * Ordenar por el entorno que se mira. Cambiar de `hh` a `sea` **reordena la
 * lista visiblemente**, y ese contraste es la demostracion del producto en un
 * clic (`docs/02` seccion 2, P1). Un test lo fija con la correlacion de rangos,
 * para que si el modelo final aplana el efecto nos enteremos aqui.
 */
export const scoreIn = (card: PitcherSeason, environment: Environment): number =>
  environment === 'hh' ? card.stuffPlusHh.value : card.stuffPlusSea.value

export const rankBy = (
  cards: readonly PitcherSeason[],
  environment: Environment,
): readonly PitcherSeason[] =>
  [...cards].sort((a, b) => scoreIn(b, environment) - scoreIn(a, environment))

/**
 * Las columnas del Radar que se ordenan con un clic en el encabezado. Mano y
 * Rol no: no tienen un orden que responda una pregunta.
 */
export const RADAR_SORT_KEYS = [
  'pitcher',
  'season',
  'hh',
  'sea',
  'delta',
  'tax',
  'kMinusBb',
  'whiff',
  'usage',
] as const
export type RadarSortKey = (typeof RADAR_SORT_KEYS)[number]

export const DEFAULT_RADAR_SORT: SortState<RadarSortKey> = { key: 'hh', direction: 'desc' }

/** El sentido del primer clic: el nombre de la A a la Z, todo lo demas de mayor a menor. */
export const firstDirection = (key: RadarSortKey): SortDirection =>
  key === 'pitcher' ? 'asc' : 'desc'

/**
 * Lo que muestran las columnas de Stuff+, Δ y uso: el arsenal entero del
 * lanzador o, con un tipo de pitch elegido, solo ese pitch. Asi «sliders»
 * compara sliders, no lanzadores que ademas tiran slider.
 */
export type RadarFocus = {
  readonly hh: Metric | null
  readonly sea: Metric | null
  readonly delta: number | null
  readonly pitch: string | null
  readonly usagePct: number | null
}

export const focusOf = (card: PitcherSeason, pitch: string | null): RadarFocus => {
  if (pitch === null) {
    const main = dominantPitch(card)
    return {
      hh: card.stuffPlusHh,
      sea: card.stuffPlusSea,
      delta: card.stuffPlusDelta,
      pitch: main?.pitch ?? null,
      usagePct: main?.usagePct ?? null,
    }
  }
  const entry = card.arsenal.find((e) => e.pitch === pitch) ?? null
  const hh = entry?.stuffPlusHh ?? null
  const sea = entry?.stuffPlusSea ?? null
  return {
    hh,
    sea,
    delta: hh === null || sea === null ? null : hh.value - sea.value,
    pitch: entry?.pitch ?? null,
    usagePct: entry?.usagePct ?? null,
  }
}

const valueOf =
  (key: RadarSortKey, pitch: string | null) =>
  (card: RadarCard): SortValue => {
    const focus = focusOf(card, pitch)
    switch (key) {
      case 'pitcher':
        return card.pitcherId
      case 'season':
        return card.season
      case 'hh':
        return focus.hh?.value ?? null
      case 'sea':
        return focus.sea?.value ?? null
      case 'delta':
        return focus.delta
      // Solo el impuesto concluyente: ordenar por uno que cruza el cero seria
      // ordenar por ruido (ADR 0003). Los no concluyentes van al final.
      case 'tax':
        return card.altitudeTax?.value ?? null
      // Extreme altitude, as shown; below the sample minimum it sorts last.
      case 'kMinusBb':
        return card.ratesHh.kMinusBbPct?.value ?? null
      case 'whiff':
        return card.ratesHh.whiffPerSwing?.value ?? null
      case 'usage':
        return focus.usagePct
    }
  }

/**
 * El Radar ordenado por una columna. El desempate es el Stuff+ en altitud
 * extrema, de mayor a menor: se ordena primero por el y luego, estable, por la
 * columna pedida.
 */
export const sortRadar = <T extends RadarCard>(
  cards: readonly T[],
  sort: SortState<RadarSortKey>,
  pitch: string | null = null,
): readonly T[] =>
  sortRows(sortRows(cards, valueOf('hh', pitch), 'desc'), valueOf(sort.key, pitch), sort.direction)

/** Correlacion de rangos de Spearman entre los dos ordenes. */
export const rankCorrelation = (cards: readonly PitcherSeason[]): number => {
  const n = cards.length
  if (n < 2) return 1

  const rank = (environment: Environment): Map<string, number> =>
    new Map(rankBy(cards, environment).map((card, index) => [key(card), index]))

  const hh = rank('hh')
  const sea = rank('sea')
  const sumSquared = cards.reduce((total, card) => {
    const difference = (hh.get(key(card)) ?? 0) - (sea.get(key(card)) ?? 0)
    return total + difference * difference
  }, 0)

  return 1 - (6 * sumSquared) / (n * (n * n - 1))
}

const key = (card: PitcherSeason): string => `${card.pitcherId}:${String(card.season)}`

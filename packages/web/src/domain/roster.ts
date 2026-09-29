import { cardsOf, pickSeason } from './pitcher'
import type { Environment, PitcherSeason, Role, SeasonEntry } from './types'

/**
 * El plantel de P6 (Despliegue) y P8 (Plantel). **Es una aproximacion**: el
 * dataset viene anonimizado y sin equipo, asi que no se sabe quien es de
 * Diablos. Se toma a los lanzadores con mas lanzamientos en altitud extrema en
 * la temporada, que es como se ve quien lanza la mitad de sus juegos en casa.
 * La decision y sus limites estan en `docs/adr/0008`; las pantallas la declaran.
 */

/** El tamano del cuerpo de lanzadores que se toma. Es una decision de producto, ajustable (ADR 0008). */
export const ROSTER_SIZE = 14

/** Los `ROSTER_SIZE` con mas lanzamientos en altitud extrema en `season`, de mas a menos. */
export const approximateRoster = (
  seasonsByPitcher: ReadonlyMap<string, readonly SeasonEntry[]>,
  season: number,
  size = ROSTER_SIZE,
): readonly string[] =>
  [...seasonsByPitcher.entries()]
    .flatMap(([id, entries]) => {
      const entry = entries.find((e) => e.season === season)
      return entry === undefined ? [] : [{ id, n: entry.nPitchesHh }]
    })
    .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id))
    .slice(0, size)
    .map((p) => p.id)

/** La ultima temporada con score de cada uno; quien no tiene ninguna no entra al tablero. */
export const latestCards = (
  cards: readonly PitcherSeason[],
  ids: readonly string[],
): readonly PitcherSeason[] =>
  ids.flatMap((id) => {
    const card = pickSeason(cardsOf(cards, id))
    return card === null ? [] : [card]
  })

const stuffIn = (card: PitcherSeason, env: Environment): number =>
  env === 'hh' ? card.stuffPlusHh.value : card.stuffPlusSea.value

/** Posicion por entorno dentro de un grupo, 1 el mejor. */
const rankBy = (cards: readonly PitcherSeason[], env: Environment): ReadonlyMap<string, number> =>
  new Map(
    [...cards]
      .sort((a, b) => stuffIn(b, env) - stuffIn(a, env))
      .map((c, i) => [`${c.pitcherId}/${String(c.season)}`, i + 1]),
  )

export type BoardRow = {
  readonly card: PitcherSeason
  readonly rankHh: number
  readonly rankSea: number
  /** Posiciones que gana al pasar de la gira a casa: positivo sube. */
  readonly move: number
}

/** El tablero completo, en el orden de casa, con lo que se mueve cada uno. */
export const deploymentBoard = (cards: readonly PitcherSeason[]): readonly BoardRow[] => {
  const hh = rankBy(cards, 'hh')
  const sea = rankBy(cards, 'sea')
  const key = (c: PitcherSeason): string => `${c.pitcherId}/${String(c.season)}`
  return cards
    .map((card) => {
      const rankHh = hh.get(key(card)) ?? 0
      const rankSea = sea.get(key(card)) ?? 0
      return { card, rankHh, rankSea, move: rankSea - rankHh }
    })
    .sort((a, b) => a.rankHh - b.rankHh)
}

/**
 * Los grupos del tablero para el entorno elegido: por rol, nunca por el Δ
 * (`docs/02` P6). Quien no tiene rol va aparte. No sugiere orden de pitcheo.
 */
export const deploymentGroups = (
  cards: readonly PitcherSeason[],
  env: Environment,
): readonly { readonly role: Role | null; readonly cards: readonly PitcherSeason[] }[] =>
  (['starter', 'reliever', null] as const)
    .map((role) => ({
      role,
      cards: cards.filter((c) => c.role === role).sort((a, b) => stuffIn(b, env) - stuffIn(a, env)),
    }))
    .filter((g) => g.cards.length > 0)

/** Rango 1 para el mayor; los empates reciben el promedio de sus rangos, como en Spearman. */
const ranks = (values: readonly number[]): number[] => {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
  const out = new Array<number>(values.length).fill(0)
  let k = 0
  while (k < order.length) {
    let j = k
    while (j + 1 < order.length && order[j + 1]?.v === order[k]?.v) j += 1
    const shared = (k + j) / 2 + 1
    for (let t = k; t <= j; t += 1) out[order[t]?.i ?? 0] = shared
    k = j + 1
  }
  return out
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}

export type OrderShift = {
  /** Spearman entre el orden en casa y el orden en gira. */
  readonly rankCorrelation: number
  readonly medianMove: number
  /** Cuantos de los 10 mejores en casa no estan entre los 10 mejores de gira. */
  readonly topTenTurnover: number
  readonly n: number
}

/**
 * Lo que justifica que el tablero exista (`docs/02` P6): cuanto cambia el orden
 * de la liga entre casa y gira. Se calcula sobre la cohorte del Radar, no sobre
 * el plantel aproximado, para que no dependa de la aproximacion.
 */
export const orderShift = (cohort: readonly PitcherSeason[]): OrderShift => {
  const hh = ranks(cohort.map((c) => c.stuffPlusHh.value))
  const sea = ranks(cohort.map((c) => c.stuffPlusSea.value))
  const n = cohort.length
  // Con empates la formula corta de Spearman es una aproximacion; con 296
  // valores de un decimal el error es despreciable y la formula queda legible.
  const d2 = hh.reduce((s, r, i) => s + (r - (sea[i] ?? 0)) ** 2, 0)
  const topHh = new Set(cohort.filter((_, i) => (hh[i] ?? 0) <= 10).map((c) => c.pitcherId))
  const topSea = new Set(cohort.filter((_, i) => (sea[i] ?? 0) <= 10).map((c) => c.pitcherId))
  return {
    rankCorrelation: 1 - (6 * d2) / (n * (n * n - 1)),
    medianMove: median(hh.map((r, i) => Math.abs(r - (sea[i] ?? 0)))),
    topTenTurnover: [...topHh].filter((id) => !topSea.has(id)).length,
    n,
  }
}

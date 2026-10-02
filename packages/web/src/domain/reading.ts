import { arsenalRows } from './arsenal'
import type { Metric, PitcherSeason } from './types'

/**
 * La «Lectura del sistema» de la Ficha: un veredicto y su porque, armados
 * desde las cifras de la tarjeta. **La regla del veredicto es provisional y de
 * producto**, no del modelo: la pantalla lo dice, y el que lo respalde es
 * trabajo del equipo de datos (`docs/11`).
 */
export type Verdict = 'sign' | 'signWithReservations' | 'notAtSeaLevelPrice'

/** 100 es el promedio de la escala de v0 (`docs/adr/0007`). */
const AVERAGE = 100

export const verdictOf = (card: PitcherSeason): Verdict => {
  if (card.altitudeTrap) return 'notAtSeaLevelPrice'
  return card.stuffPlusHh.value - card.stuffPlusHh.se >= AVERAGE ? 'sign' : 'signWithReservations'
}

export type PitchDelta = {
  readonly pitch: string
  readonly usagePct: number
  /** Altitud extrema menos nivel del mar, con su banda. */
  readonly delta: Metric
}

/**
 * Lo que pierde cada pitch en altitud extrema. La banda suma las dos en
 * cuadratura: son muestras distintas, una en cada entorno, y se suponen
 * independientes.
 */
export const pitchDeltas = (card: PitcherSeason): readonly PitchDelta[] =>
  arsenalRows(card).flatMap((row) =>
    row.stuffPlusHh === null || row.stuffPlusSea === null
      ? []
      : [
          {
            pitch: row.pitch,
            usagePct: row.usagePct,
            delta: {
              value: row.stuffPlusHh.value - row.stuffPlusSea.value,
              se: Math.hypot(row.stuffPlusHh.se, row.stuffPlusSea.se),
            },
          },
        ],
  )

export type Reading = {
  readonly verdict: Verdict
  /** El pitch que mas usa, y lo que pierde. */
  readonly main: PitchDelta | null
  /** El que mejor aguanta contra el que peor, si son distintos. */
  readonly lever: { readonly best: PitchDelta; readonly worst: PitchDelta } | null
}

export const readingOf = (card: PitcherSeason): Reading => {
  const deltas = pitchDeltas(card)
  const byLoss = [...deltas].sort((a, b) => b.delta.value - a.delta.value)
  const best = byLoss[0]
  const worst = byLoss[byLoss.length - 1]
  return {
    verdict: verdictOf(card),
    main: deltas[0] ?? null,
    lever:
      best === undefined || worst === undefined || best.pitch === worst.pitch
        ? null
        : { best, worst },
  }
}

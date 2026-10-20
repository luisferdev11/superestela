import {
  baselinePitches,
  MIN_PITCHES_FOR_BASELINE,
  type ArsenalPitch,
  type PitcherArsenal,
} from './simulator'

/**
 * El mapa de movimiento de la Ficha: el arsenal medido en los dos entornos,
 * mas la forma promedio de la liga por tipo. Break horizontal del lado del
 * brazo, como en `arsenals.json`: positivo hacia el brazo que lanza.
 */
export type Shape = { readonly ivb: number; readonly hb: number }

/** El promedio de la liga no trae signo (`abs_hb`); el lado lo pone el pitch del lanzador. */
export type LeagueShape = { readonly ivb: number; readonly absHb: number }

export type LeagueShapes = ReadonlyMap<
  string,
  { readonly sea: LeagueShape | null; readonly hh: LeagueShape | null }
>

export type MapPitch = {
  readonly pitchType: string
  /**
   * The sea-level usage, as the caption says; `null` when the pitch was not
   * thrown at sea level at all. Never the altitude usage: mixing the two made
   * the labels add up to more than 100%.
   */
  readonly usage: number | null
  /**
   * Thrown at sea level, but fewer times than the minimum to draw its shape
   * (`MIN_PITCHES_FOR_BASELINE`, the Simulator's and the Projection's too).
   */
  readonly seaBelowMinimum?: boolean
  readonly sea: Shape | null
  readonly hh: Shape | null
  readonly league: Shape | null
}

const shapeOf = (p: ArsenalPitch | undefined): Shape | null =>
  p === undefined ? null : { ivb: p.ivb, hb: p.horizontalBreak }

/** Los pitches con muestra en al menos un entorno, del mas usado al menos. */
export const arsenalMapPitches = (
  arsenal: PitcherArsenal,
  league: LeagueShapes,
): readonly MapPitch[] => {
  const sea = baselinePitches(arsenal.sea)
  const hh = baselinePitches(arsenal.hh)
  const types = [...new Set([...sea, ...hh].map((p) => p.pitchType))]
  return types
    .map((pitchType): MapPitch => {
      const s = sea.find((p) => p.pitchType === pitchType)
      const h = hh.find((p) => p.pitchType === pitchType)
      const seaAny = arsenal.sea.find((p) => p.pitchType === pitchType)
      const own = s ?? h
      const avg = league.get(pitchType)?.sea ?? null
      const side = own === undefined || own.horizontalBreak >= 0 ? 1 : -1
      return {
        pitchType,
        usage: seaAny?.usage ?? null,
        seaBelowMinimum: seaAny !== undefined && seaAny.n < MIN_PITCHES_FOR_BASELINE,
        sea: shapeOf(s),
        hh: shapeOf(h),
        league: avg === null ? null : { ivb: avg.ivb, hb: side * avg.absHb },
      }
    })
    .sort((a, b) => (b.usage ?? -1) - (a.usage ?? -1))
}

/** A label on the map: where its anchor point is and roughly how wide it reads. */
export type LabelBox = {
  readonly x: number
  readonly y: number
  readonly width: number
  /** `end`: the text runs to the left of `x`. */
  readonly anchor: 'start' | 'end'
}

const extent = (b: LabelBox): readonly [number, number] =>
  b.anchor === 'start' ? [b.x, b.x + b.width] : [b.x - b.width, b.x]

/**
 * Nudges labels down, top to bottom, until no two overlap: a simple collision
 * pass so two pitches with close shapes do not print one name over the other.
 * Returns the new `y` of each label, in the order given.
 */
export const separateLabels = (boxes: readonly LabelBox[], lineHeight: number): number[] => {
  const order = boxes.map((b, i) => ({ b, i })).sort((p, q) => p.b.y - q.b.y)
  const placed: { readonly x: readonly [number, number]; readonly y: number }[] = []
  const ys = boxes.map((b) => b.y)
  for (const { b, i } of order) {
    const [left, right] = extent(b)
    let y = b.y
    for (const other of [...placed].sort((p, q) => p.y - q.y)) {
      const overlapsX = left < other.x[1] && other.x[0] < right
      if (overlapsX && Math.abs(y - other.y) < lineHeight) y = other.y + lineHeight
    }
    placed.push({ x: [left, right], y })
    ys[i] = y
  }
  return ys
}

/**
 * El marco del mapa: cuadrado, simetrico y en multiplos de 6 pulgadas, para
 * que los dos ejes se lean con la misma regla y cero quede al centro.
 */
export const mapHalfSpan = (pitches: readonly MapPitch[], step = 6, min = 18): number => {
  const values = pitches.flatMap((p) =>
    [p.sea, p.hh, p.league].flatMap((s) => (s === null ? [] : [Math.abs(s.ivb), Math.abs(s.hb)])),
  )
  const max = Math.max(min, ...values)
  return Math.ceil(max / step) * step
}

import { baselinePitches, type ArsenalPitch, type PitcherArsenal } from './simulator'

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
  /** El uso a nivel del mar, o en altura si solo ahi hay muestra. */
  readonly usage: number
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
      const own = s ?? h
      const avg = league.get(pitchType)?.sea ?? null
      const side = own === undefined || own.horizontalBreak >= 0 ? 1 : -1
      return {
        pitchType,
        usage: s?.usage ?? h?.usage ?? 0,
        sea: shapeOf(s),
        hh: shapeOf(h),
        league: avg === null ? null : { ivb: avg.ivb, hb: side * avg.absHb },
      }
    })
    .sort((a, b) => b.usage - a.usage)
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

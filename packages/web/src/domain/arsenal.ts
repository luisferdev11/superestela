import type { ArsenalEntry, PitcherSeason } from './types'

/**
 * El lanzamiento dominante de un arsenal: el de mayor uso. `docs/02` seccion 2
 * lo pide como columna de la P1 y como filtro.
 */
export const dominantPitch = (card: PitcherSeason): ArsenalEntry | null =>
  card.arsenal.reduce<ArsenalEntry | null>(
    (best, entry) => (best === null || entry.usagePct > best.usagePct ? entry : best),
    null,
  )

/** Los tipos presentes en una cohorte, ordenados por cuantos lanzadores los dominan. */
export const dominantPitchTypes = (cards: readonly PitcherSeason[]): readonly string[] => {
  const counts = new Map<string, number>()
  for (const card of cards) {
    const pitch = dominantPitch(card)
    if (pitch !== null) counts.set(pitch.pitch, (counts.get(pitch.pitch) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([pitch]) => pitch)
}

/**
 * Una fila de la tabla del arsenal de la Ficha: nivel del mar contra Harp
 * Helu. El break horizontal va en valor absoluto porque `mockup_data.json` lo
 * trae en el marco de Trackman, no del lado del brazo; el mapa de movimiento
 * usa la forma con signo de `arsenals.json`.
 */
export type ArsenalRow = ArsenalEntry & {
  readonly absHbSea: number | null
  readonly absHbHh: number | null
}

/** El arsenal de mayor a menor uso, que es como lo lee un coach. */
export const arsenalRows = (card: PitcherSeason): readonly ArsenalRow[] =>
  [...card.arsenal]
    .sort((a, b) => b.usagePct - a.usagePct)
    .map((entry) => ({
      ...entry,
      absHbSea: entry.hbSea === null ? null : Math.abs(entry.hbSea),
      absHbHh: entry.hbHh === null ? null : Math.abs(entry.hbHh),
    }))

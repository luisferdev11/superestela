import { describe, expect, it } from 'vitest'
import { arsenalMapPitches, mapHalfSpan, separateLabels } from './arsenalMap'
import { loadDataset } from '@/sources/mockupSource'
import { loadSimulatorDataset } from '@/sources/simulatorSource'

/** Sobre `arsenals.json` y `mockup_data.json` reales: el mapa dibuja lo medido. */
vi.mock('server-only', () => ({}))

const load = async () => {
  const [{ leagueShapes }, { arsenals }] = await Promise.all([
    loadDataset(),
    loadSimulatorDataset(),
  ])
  return { leagueShapes, arsenals }
}

describe('el mapa de movimiento de pitcher_00069 2025', () => {
  it('la recta va primero, con su forma medida en los dos entornos', async () => {
    const { leagueShapes, arsenals } = await load()
    const arsenal = arsenals.find((a) => a.key === 'pitcher_00069/2025')
    if (arsenal === undefined) throw new Error('sin arsenal de pitcher_00069 2025')
    const [fastball] = arsenalMapPitches(arsenal, leagueShapes)
    expect(fastball?.pitchType).toBe('Four-Seam')
    expect(fastball?.sea).toEqual({ ivb: 20.7, hb: 8.17 })
    // En altura la recta sube menos: el mapa lo tiene que dejar ver.
    expect(fastball?.hh?.ivb ?? Infinity).toBeLessThan(fastball?.sea?.ivb ?? 0)
  })

  it('el promedio de la liga cae del mismo lado del brazo que el pitch del lanzador', async () => {
    const { leagueShapes, arsenals } = await load()
    for (const arsenal of arsenals) {
      for (const p of arsenalMapPitches(arsenal, leagueShapes)) {
        const own = p.sea ?? p.hh
        if (own === null || p.league === null || own.hb === 0) continue
        expect(Math.sign(p.league.hb)).toBe(Math.sign(own.hb))
      }
    }
  })
})

describe('el uso de las etiquetas es el de nivel del mar, como dice el pie', () => {
  it('en ningun arsenal suman mas de 100%', async () => {
    const { leagueShapes, arsenals } = await load()
    for (const arsenal of arsenals) {
      const total = arsenalMapPitches(arsenal, leagueShapes).reduce(
        (sum, p) => sum + (p.usage ?? 0),
        0,
      )
      // arsenals.json rounds each usage to three decimals.
      expect(total).toBeLessThanOrEqual(1.005)
    }
  })

  it('pitcher_00019 2026: la recta lleva su uso del mar aunque no tenga punto ahi', async () => {
    const { leagueShapes, arsenals } = await load()
    const arsenal = arsenals.find((a) => a.key === 'pitcher_00019/2026')
    if (arsenal === undefined) throw new Error('sin arsenal de pitcher_00019 2026')
    const fastball = arsenalMapPitches(arsenal, leagueShapes).find(
      (p) => p.pitchType === 'Four-Seam',
    )
    const seaFastball = arsenal.sea.find((p) => p.pitchType === 'Four-Seam')
    expect(fastball?.sea).toBeNull()
    expect(fastball?.seaBelowMinimum).toBe(true)
    expect(fastball?.usage).toBe(seaFastball?.usage)
  })

  it('un pitch que no se lanzo a nivel del mar no tiene uso que mostrar', async () => {
    const { leagueShapes, arsenals } = await load()
    for (const arsenal of arsenals) {
      for (const p of arsenalMapPitches(arsenal, leagueShapes)) {
        const thrown = arsenal.sea.some((s) => s.pitchType === p.pitchType)
        expect(p.usage === null).toBe(!thrown)
      }
    }
  })
})

describe('las etiquetas no se enciman', () => {
  it('dos etiquetas a la misma altura y del mismo lado se separan una linea', () => {
    const ys = separateLabels(
      [
        { x: 100, y: 50, width: 80, anchor: 'start' },
        { x: 120, y: 52, width: 80, anchor: 'start' },
        { x: 400, y: 50, width: 80, anchor: 'start' },
      ],
      17,
    )
    expect(ys).toEqual([50, 67, 50])
  })

  it('una etiqueta hacia la izquierda y otra hacia la derecha del mismo punto no chocan', () => {
    const ys = separateLabels(
      [
        { x: 200, y: 50, width: 80, anchor: 'end' },
        { x: 210, y: 50, width: 80, anchor: 'start' },
      ],
      17,
    )
    expect(ys).toEqual([50, 50])
  })
})

describe('el marco del mapa', () => {
  it('contiene cada punto de cada arsenal y es multiplo de 6', async () => {
    const { leagueShapes, arsenals } = await load()
    for (const arsenal of arsenals) {
      const pitches = arsenalMapPitches(arsenal, leagueShapes)
      const half = mapHalfSpan(pitches)
      expect(half % 6).toBe(0)
      for (const p of pitches) {
        for (const s of [p.sea, p.hh, p.league]) {
          if (s === null) continue
          expect(Math.abs(s.ivb)).toBeLessThanOrEqual(half)
          expect(Math.abs(s.hb)).toBeLessThanOrEqual(half)
        }
      }
    }
  })
})

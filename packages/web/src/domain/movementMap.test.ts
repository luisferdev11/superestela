import { describe, expect, it } from 'vitest'
import { cellAt, relativeWhiff, sharedExtent, sharedWhiffRange, type MapPanel } from './movementMap'

const panel = (rates: readonly number[]): MapPanel => ({
  binIn: 2,
  meanWhiffPerSwing: 0.2,
  cells: rates.map((r, i) => ({ ivb: i, horizontalBreak: i, swings: 100, whiffPerSwing: r })),
  extremes: [],
})

describe('el color del mapa', () => {
  it('se mide contra la media de nivel del mar, tambien en el panel de altura', () => {
    const cell = { ivb: 0, horizontalBreak: 0, swings: 100, whiffPerSwing: 0.15 }
    expect(relativeWhiff(cell, 0.21)).toBeCloseTo(-0.06)
  })

  it('usa una escala compartida por los dos paneles', () => {
    const sea = panel([0.25, 0.18])
    const hh = panel([0.12, 0.2])
    expect(sharedWhiffRange([sea, hh], 0.21)).toBeCloseTo(0.09)
  })
})

describe('donde cae una forma', () => {
  const p = panel([0.3])
  it('encuentra la celda que la contiene', () => {
    expect(cellAt(p, 0.5, -0.5)?.whiffPerSwing).toBe(0.3)
  })
  it('fuera de las celdas con muestra no hay celda', () => {
    expect(cellAt(p, 10, 10)).toBeNull()
  })
})

describe('el encuadre compartido', () => {
  it('es cuadrado y contiene celdas y puntos', () => {
    const e = sharedExtent([panel([0.2, 0.2])], [{ ivb: 20, horizontalBreak: 0 }], 0)
    expect(e.hbMax - e.hbMin).toBeCloseTo(e.ivbMax - e.ivbMin)
    expect(e.ivbMax).toBeGreaterThanOrEqual(20)
    expect(e.ivbMin).toBeLessThanOrEqual(-1)
  })
})

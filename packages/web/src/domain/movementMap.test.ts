import { describe, expect, it } from 'vitest'
import { relativeWhiff, sharedWhiffRange, type MapPanel } from './movementMap'

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

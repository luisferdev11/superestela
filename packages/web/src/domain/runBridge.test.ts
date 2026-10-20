import { describe, expect, it } from 'vitest'
import { runsOfShift, xrvOf, type RunBridge } from './runBridge'
import type { UsageShift } from './plan'

const BRIDGE: RunBridge = {
  modelId: '1.1.0+abcdef0',
  xrvByType: { Slider: [-0.02, 0.011], 'Four-Seam': [-0.006, 0.023] },
  pitchesPerInning: 18.62,
}

const shift = (points: number): UsageShift => ({
  from: 'Four-Seam',
  to: 'Slider',
  points,
  shares: new Map(),
  before: { value: 100, se: 1 },
  after: { value: 101, se: 1 },
})

describe('el puente de Stuff+ a carreras', () => {
  it('un pitch de 100 vale la media de su tipo y diez puntos menos, una desviacion mas', () => {
    expect(xrvOf(BRIDGE, 'Slider', { value: 100, se: 0 })?.value).toBeCloseTo(-0.02)
    expect(xrvOf(BRIDGE, 'Slider', { value: 90, se: 0 })?.value).toBeCloseTo(-0.009)
    expect(xrvOf(BRIDGE, 'Cutter', { value: 90, se: 0 })).toBeNull()
  })

  it('mover uso a un pitch que vale menos carreras ahorra carreras por 9 entradas', () => {
    const stuff = new Map([
      ['Four-Seam', { value: 90, se: 1 }],
      ['Slider', { value: 110, se: 1 }],
    ])
    const runs = runsOfShift(BRIDGE, shift(20), stuff)
    // Four-Seam at 90: -0.006 + 0.023 = 0.017; Slider at 110: -0.02 - 0.011 = -0.031.
    expect(runs?.value).toBeCloseTo(18.62 * 9 * 0.2 * (-0.031 - 0.017), 6)
    expect(runs?.se).toBeGreaterThan(0)
  })

  it('sin la escala de un tipo no hay cifra', () => {
    expect(
      runsOfShift(BRIDGE, shift(20), new Map([['Four-Seam', { value: 90, se: 1 }]])),
    ).toBeNull()
  })
})

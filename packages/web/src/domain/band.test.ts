import { describe, expect, it } from 'vitest'
import { halfWidth95, toBand95, Z95 } from './band'
import { simulateResponseSchema } from '@/sources/simulateResponse'
import { es } from '@/i18n/es'

/** The «±» convention (`docs/12` §2.1): the 95% half-width on every screen. */

const m = (value: number, se: number) => ({ value, se })
const env = (name: 'sea' | 'harpHelu') => ({
  environment: name,
  densityIndex: 1,
  shape: { ivb: m(15, 0.5), horizontalBreak: m(8, 0.25) },
  approach: { plateSpeed: 85, vaa: -6 },
  stuffPlus: m(100, 2),
  differentials: null,
  comparables: [],
})

describe('the «±» is the 95% band everywhere', () => {
  it('a standard error becomes 1.96 of them', () => {
    expect(halfWidth95(1)).toBe(Z95)
    expect(toBand95(m(4, 2))).toEqual(m(4, 2 * Z95))
  })

  it('the API answer is converted once, at the boundary', () => {
    const parsed = simulateResponseSchema.parse({
      modelId: null,
      usesArsenal: false,
      stuffPlusShown: true,
      stuffPlusReason: null,
      sea: env('sea'),
      harpHelu: env('harpHelu'),
      altitudeDelta: { total: m(-5, 1), shape: m(-3, 1), environment: m(-2, 1) },
      primaryFastball: null,
      plausibility: { isPlausible: true, squaredDistance: 1, threshold: 2, unusual: [] },
      movementPerKrpm: { value: 9, percentile: 50 },
    })
    expect(parsed.sea.stuffPlus?.se).toBeCloseTo(2 * Z95, 9)
    expect(parsed.harpHelu.shape.ivb.se).toBeCloseTo(0.5 * Z95, 9)
    expect(parsed.altitudeDelta?.total.se).toBeCloseTo(Z95, 9)
  })

  it('no screen copy calls the «±» a standard error', () => {
    expect(JSON.stringify(es)).not.toMatch(/error est(á|\\u00e1)ndar/)
  })
})

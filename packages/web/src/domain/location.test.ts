import { describe, expect, it } from 'vitest'
import { readLocation, type LocationPanel } from './location'

const panel = (height: number, zone: number, n = 1000): LocationPanel => ({
  nPitches: n,
  meanPlateHeightFt: height,
  plateHeightSdFt: 0.9,
  zoneShare: zone,
  whiffPerSwing: 0.25,
  locationPlus: null,
  grid: [[1]],
  sideRangeFt: [-2, 2],
  heightRangeFt: [0.5, 4.5],
})

describe('la lectura de la ubicacion', () => {
  it('apuntar mas alto y perder la zona es sobrecompensar', () => {
    const r = readLocation(panel(2.3, 0.45), panel(2.6, 0.38))
    expect(r.verdict).toBe('overcompensates')
    expect(r.heightIn.value).toBeCloseTo(3.6)
    expect(r.zonePp.value).toBeCloseTo(-7)
  })

  it('un cambio dentro de su banda no se afirma', () => {
    const r = readLocation(panel(2.3, 0.45, 120), panel(2.35, 0.43, 120))
    expect(r.verdict).toBe('noChange')
    expect(r.heightIn.ci95).toBeGreaterThan(Math.abs(r.heightIn.value))
  })

  it('apuntar mas alto sin perder la zona se dice aparte', () => {
    expect(readLocation(panel(2.3, 0.45), panel(2.6, 0.46)).verdict).toBe('higher')
    expect(readLocation(panel(2.3, 0.45), panel(2.3, 0.38)).verdict).toBe('losesZone')
  })
})

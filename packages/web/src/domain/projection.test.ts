import { describe, expect, it } from 'vitest'
import {
  bandAgreement,
  checkAgainstMeasured,
  isExtrapolation,
  projectedPitches,
} from './projection'
import { MIN_PITCHES_FOR_BASELINE } from './simulator'
import { loadProjections } from '@/sources/projectionSource'

vi.mock('server-only', () => ({}))

const pitcher = async (key: string) => {
  const p = (await loadProjections()).pitchers.get(key)
  if (p === undefined) throw new Error(`${key} no esta en projections.json`)
  return p
}

describe('la proyeccion de pitcher_00069 2025', () => {
  it('la recta proyecta 15.6 ± 0.9 de IVB en el Harp Helu, el mismo numero que el Simulador', async () => {
    const [fastball] = projectedPitches(await pitcher('pitcher_00069/2025'))
    expect(fastball?.pitchType).toBe('Four-Seam')
    expect(fastball?.projected.hh.ivb.value).toBeCloseTo(15.61, 2)
    expect(fastball?.projected.hh.ivb.se).toBe(0.92)
  })

  it('la mayoria de sus pitches con muestra en altura cae dentro de la banda (docs/10 T6)', async () => {
    const { inBand, checked } = bandAgreement(await pitcher('pitcher_00069/2025'))
    expect(checked).toBeGreaterThan(0)
    expect(inBand / checked).toBeGreaterThan(0.5)
  })

  it('un pitch con pocos lanzamientos en altura no se usa de juez', async () => {
    for (const x of projectedPitches(await pitcher('pitcher_00069/2025'))) {
      if ((x.measuredHh?.n ?? 0) < MIN_PITCHES_FOR_BASELINE) {
        expect(checkAgainstMeasured(x)).toBeNull()
      }
    }
  })
})

describe('la proyeccion en toda la liga', () => {
  it('cada eje cae dentro de su banda al 95% en al menos 90% de los pitches con muestra', async () => {
    let ivb = 0
    let hb = 0
    let n = 0
    for (const p of (await loadProjections()).pitchers.values()) {
      for (const x of projectedPitches(p)) {
        const c = checkAgainstMeasured(x)
        if (c === null) continue
        n += 1
        ivb += Number(c.ivbInBand)
        hb += Number(c.horizontalBreakInBand)
      }
    }
    expect(n).toBeGreaterThan(500)
    expect(ivb / n).toBeGreaterThan(0.9)
    expect(hb / n).toBeGreaterThan(0.9)
  })

  it('la altitud media se declara extrapolacion y el Harp Helu no', () => {
    expect(isExtrapolation('medium')).toBe(true)
    expect(isExtrapolation('hh')).toBe(false)
  })

  it('el factor a altitud media es menor que 1 y mayor que el del Harp Helu', async () => {
    const { factors } = await loadProjections()
    expect(factors.medium).toBeLessThan(1)
    expect(factors.medium).toBeGreaterThan(factors.hh)
  })
})

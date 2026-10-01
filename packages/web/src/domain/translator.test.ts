import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LIMITS,
  checkRows,
  exampleRows,
  fileRows,
  isReady,
  normalizedUsage,
  translatorRequests,
  validationRows,
  weightedMetric,
  type TranslatorRow,
} from './translator'
import { CONTROLS, type PitcherArsenal, type PitchValues } from './simulator'

const SHAPE: PitchValues = {
  releaseSpeed: 92.7,
  ivb: 20.7,
  horizontalBreak: 8.2,
  extension: 6.1,
  releaseHeight: 6.0,
  releaseSide: 2.5,
  spinRate: 2386,
  spinAxis: 203,
}
const row = (over: Partial<TranslatorRow> = {}): TranslatorRow => ({
  ...SHAPE,
  pitchType: 'Four-Seam',
  usage: 0.6,
  ...over,
})

describe('la tabla del Traductor', () => {
  it('marca la celda fuera de lo que la API acepta, y solo esa', () => {
    const [check] = checkRows([row({ releaseSpeed: 120 })])
    expect([...(check?.cells ?? [])]).toEqual(['releaseSpeed'])
    expect(check?.problems.has('outOfRange')).toBe(true)
  })

  it('no deja dos filas del mismo tipo: el arsenal es un reparto', () => {
    const checks = checkRows([row(), row({ usage: 0.2 })])
    expect(checks.every((c) => c.problems.has('duplicateType'))).toBe(true)
    expect(isReady([row(), row({ usage: 0.2 })])).toBe(false)
  })

  it('un uso vacio, negativo o arriba de 100 no es un reparto', () => {
    for (const usage of [Number.NaN, -5, 120]) {
      expect(checkRows([row({ usage })])[0]?.problems.has('badUsage'), String(usage)).toBe(true)
      expect(isReady([row({ usage }), row({ pitchType: 'Slider' })])).toBe(false)
    }
  })

  it('sin ningun uso no hay arsenal que ponderar', () => {
    expect(isReady([row({ usage: 0 })])).toBe(false)
    expect(isReady([row(), row({ pitchType: 'Slider', usage: 0.4 })])).toBe(true)
  })

  it('el uso capturado se normaliza aunque no sume 100', () => {
    expect(normalizedUsage([row({ usage: 30 }), row({ pitchType: 'Slider', usage: 10 })])).toEqual([
      0.75, 0.25,
    ])
  })

  it('los limites son los de la API de Python', () => {
    const source = readFileSync(path.join(process.cwd(), '../api/schemas.py'), 'utf8')
    const pitchIn = source.slice(
      source.indexOf('class PitchIn'),
      source.indexOf('class ArsenalPitchIn'),
    )
    const snake = (c: string) => c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    for (const control of CONTROLS) {
      const line = pitchIn.split('\n').find((l) => l.trim().startsWith(`${snake(control)}:`)) ?? ''
      const high = /le=(-?[\d.]+)/.exec(line)?.[1]
      expect(Number(high), control).toBe(LIMITS[control].max)
      const low = /ge=(-?[\d.]+)/.exec(line)?.[1]
      // spin_rate es `gt=0`: el minimo entero que acepta es 1.
      expect(low === undefined ? 1 : Number(low), control).toBe(LIMITS[control].min)
    }
  })
})

describe('las preguntas a la API', () => {
  it('una por pitch, con el arsenal completo, el uso normalizado y el origen', () => {
    const rows = [row({ usage: 60 }), row({ pitchType: 'Slider', usage: 40, ivb: 2 })]
    const requests = translatorRequests(rows, 'Left', 0.903)
    expect(requests).toHaveLength(2)
    expect(requests[1]?.pitch).toMatchObject({ pitchType: 'Slider', pitcherHand: 'Left', ivb: 2 })
    expect(requests[0]?.arsenal.map((a) => a.usage)).toEqual([0.6, 0.4])
    expect(requests.every((r) => r.originDensityIndex === 0.903 && r.pitcherId === null)).toBe(true)
    // A nivel del mar el origen no viaja: es el default de la API.
    expect(translatorRequests(rows, 'Left', 1).every((r) => !('originDensityIndex' in r))).toBe(
      true,
    )
    // Uso no es perilla: la API rechaza campos que no conoce.
    expect(Object.keys(requests[0]?.pitch ?? {}).sort()).toEqual(
      [...CONTROLS, 'pitchType', 'pitcherHand'].sort(),
    )
  })

  it('el ejemplo real parte de los pitches con muestra a nivel del mar', () => {
    const arsenal: PitcherArsenal = {
      key: 'pitcher_00069/2025',
      pitcherId: 'pitcher_00069',
      season: 2025,
      hand: 'Right',
      sea: [
        { ...SHAPE, pitchType: 'Four-Seam', usage: 0.7, n: 292, whiffPerSwing: 0.27 },
        { ...SHAPE, pitchType: 'Changeup', usage: 0.01, n: 4, whiffPerSwing: 0.5 },
      ],
      hh: [],
    }
    expect(exampleRows(arsenal).map((r) => r.pitchType)).toEqual(['Four-Seam'])
  })
})

describe('el arsenal ponderado', () => {
  it('pondera por uso los pitches con score y suma las bandas como independientes', () => {
    const out = weightedMetric([{ value: 90, se: 3 }, null, { value: 110, se: 4 }], [0.5, 0.2, 0.5])
    expect(out?.value).toBeCloseTo(100)
    expect(out?.se).toBeCloseTo(Math.hypot(1.5, 2))
  })

  it('sin ningun score no hay numero', () => {
    expect(weightedMetric([null, null], [0.5, 0.5])).toBeNull()
  })
})

describe('el archivo y la validacion', () => {
  const PITCH = {
    releaseSpeed: 92,
    ivb: 17,
    horizontalBreak: 8,
    spinRate: 2300,
    spinAxis: 210,
    extension: 6,
    releaseHeight: 6,
    releaseSide: 2,
  }

  it('el resumen del archivo pasa a filas con el uso en porcentaje', () => {
    const rows = fileRows([
      { ...PITCH, pitchType: 'Four-Seam', usage: 0.6667 },
      { ...PITCH, pitchType: 'Slider', usage: 0.3333 },
    ])
    expect(rows.map((r) => r.usage)).toEqual([66.7, 33.3])
    expect(isReady(rows)).toBe(true)
  })

  it('lo medido se juzga contra la banda al 95% y solo con 30 lanzamientos o mas', () => {
    const projected = { ivb: { value: 15, se: 1 }, horizontalBreak: { value: 6, se: 1 } }
    const measured = (pitchType: 'Four-Seam' | 'Slider', ivb: number, n: number) => ({
      ...PITCH,
      ivb,
      horizontalBreak: 6,
      pitchType,
      usage: 0.5,
      n,
      whiffPerSwing: null,
    })
    const rows = [
      row({ pitchType: 'Four-Seam' }),
      row({ pitchType: 'Slider' }),
      row({ pitchType: 'Cutter' }),
    ]
    const out = validationRows(
      rows,
      [projected, projected, projected],
      [measured('Four-Seam', 16.5, 200), measured('Slider', 30, 10)],
    )
    expect(out.map((r) => r.isWithinBand)).toEqual([true, null, null])
    expect(
      validationRows(rows, [projected], [measured('Four-Seam', 20, 200)])[0]?.isWithinBand,
    ).toBe(false)
  })
})

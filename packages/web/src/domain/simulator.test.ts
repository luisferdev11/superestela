import { describe, expect, it } from 'vitest'
import {
  buildRequest,
  canSimulate,
  changedControls,
  labArsenal,
  leagueMedian,
  parseSimulatorStart,
  simulatorHref,
  sliderSpec,
  type ArsenalPitch,
  type Distributions,
  type PitcherArsenal,
  type PitchValues,
} from './simulator'

const FOUR_SEAM: PitchValues = {
  releaseSpeed: 92,
  ivb: 17,
  horizontalBreak: 9,
  extension: 6,
  releaseHeight: 6,
  releaseSide: 1.6,
  spinRate: 2330,
  spinAxis: 211,
}

const pitch = (
  pitchType: ArsenalPitch['pitchType'],
  usage: number,
  v: PitchValues,
): ArsenalPitch => ({
  ...v,
  pitchType,
  usage,
  n: 100,
  whiffPerSwing: 0.2,
})

describe('los sliders', () => {
  it('abarcan la banda de la liga y media banda mas a cada lado', () => {
    const spec = sliderSpec({ p5: 87, p50: 91.7, p95: 95.8 }, 'releaseSpeed')
    expect(spec.min).toBeCloseTo(82.6)
    expect(spec.max).toBeCloseTo(100.2)
    expect(spec.min).toBeLessThan(spec.league.p5)
  })

  it('el eje de spin no sale de la circunferencia', () => {
    const spec = sliderSpec({ p5: 10, p50: 200, p95: 350 }, 'spinAxis')
    expect(spec.min).toBe(0)
    expect(spec.max).toBe(360)
  })
})

describe('el laboratorio parte del pitch mediano de la liga', () => {
  it('toma la mediana de cada perilla', () => {
    const q = { p5: 0, p50: 5, p95: 10 }
    const d = { 'Four-Seam': Object.fromEntries(Object.keys(FOUR_SEAM).map((k) => [k, q])) }
    const median = leagueMedian(d as unknown as Distributions, 'Four-Seam')
    expect(Object.values(median).every((v) => v === 5)).toBe(true)
  })
})

describe('la recta de referencia del laboratorio (20 oct)', () => {
  const q = { p5: 0, p50: 5, p95: 10 }
  const d = {
    'Four-Seam': Object.fromEntries(Object.keys(FOUR_SEAM).map((k) => [k, q])),
  } as unknown as Distributions
  const reference = { releaseSpeed: 93, ivb: 16, horizontalBreak: 8 }

  it('es una recta: la mediana de la liga con la velocidad y el movimiento elegidos', () => {
    const [fastball, ...rest] = labArsenal(d, reference)
    expect(rest).toHaveLength(0)
    expect(fastball).toMatchObject({ pitchType: 'Four-Seam', ...reference, extension: 5 })
  })

  it('va en la peticion contra el pitch simulado; si se simula la recta, la reemplaza', () => {
    const slider = { ...FOUR_SEAM, releaseSpeed: 85, ivb: 1, horizontalBreak: -4 }
    expect(buildRequest(slider, 'Slider', 'Right', labArsenal(d, reference)).arsenal).toEqual([
      expect.objectContaining({ pitchType: 'Four-Seam', releaseSpeed: 93, ivb: 16 }),
    ])
    expect(buildRequest(slider, 'Four-Seam', 'Right', labArsenal(d, reference)).arsenal).toEqual([
      expect.objectContaining({ pitchType: 'Four-Seam', releaseSpeed: 85, ivb: 1 }),
    ])
  })
})

describe('la peticion a la API', () => {
  const changeup = { ...FOUR_SEAM, releaseSpeed: 84, ivb: 7, horizontalBreak: 14 }
  const arsenal = [pitch('Four-Seam', 0.6, FOUR_SEAM), pitch('Changeup', 0.4, changeup)]

  it('el pitch simulado reemplaza a su version real en el arsenal', () => {
    const faster = { ...FOUR_SEAM, releaseSpeed: 95 }
    const req = buildRequest(faster, 'Four-Seam', 'Right', arsenal)
    expect(req.arsenal.find((p) => p.pitchType === 'Four-Seam')?.releaseSpeed).toBe(95)
    expect(req.arsenal.find((p) => p.pitchType === 'Changeup')?.releaseSpeed).toBe(84)
  })

  it('lleva al lanzador, para excluirlo de sus propios comparables', () => {
    expect(buildRequest(changeup, 'Changeup', 'Left', arsenal, 'pitcher_00069').pitcherId).toBe(
      'pitcher_00069',
    )
    expect(buildRequest(changeup, 'Changeup', 'Left', []).pitcherId).toBeNull()
  })

  it('lleva la mano y el tipo del pitch', () => {
    const req = buildRequest(changeup, 'Changeup', 'Left', arsenal)
    expect(req.pitch).toMatchObject({ pitchType: 'Changeup', pitcherHand: 'Left', ivb: 7 })
  })
})

describe('lo que el coach movio', () => {
  it('el pitch real no tiene cambios y un slider movido si', () => {
    expect(changedControls(FOUR_SEAM, FOUR_SEAM)).toEqual([])
    expect(changedControls({ ...FOUR_SEAM, ivb: 18 }, FOUR_SEAM)).toEqual(['ivb'])
  })
})

describe('abrir el Simulador desde la Ficha', () => {
  const ARSENALS: PitcherArsenal[] = [
    {
      key: 'pitcher_00069/2025',
      pitcherId: 'pitcher_00069',
      season: 2025,
      hand: 'Right',
      sea: [
        { ...FOUR_SEAM, pitchType: 'Four-Seam', usage: 0.7, n: 292, whiffPerSwing: 0.27 },
        { ...FOUR_SEAM, pitchType: 'Changeup', usage: 0.01, n: 4, whiffPerSwing: 0.5 },
      ],
      hh: [],
    },
  ]
  const params = (href: string) => new URL(href, 'http://x').searchParams

  it('el enlace de la Ficha vuelve como la misma seleccion', () => {
    const href = simulatorHref('pitcher_00069', 2025, 'Four-Seam')
    expect(parseSimulatorStart(params(href), ARSENALS)).toEqual({
      pitcherKey: 'pitcher_00069/2025',
      pitchType: 'Four-Seam',
    })
  })

  it('una URL que no corresponde a nada abre el Simulador como siempre', () => {
    for (const href of [
      '/simulador',
      simulatorHref('pitcher_99999', 2025, 'Four-Seam'),
      simulatorHref('pitcher_00069', 2025, 'Knuckleball'),
      // Cuatro pitches no son una linea base: no se ofrece.
      simulatorHref('pitcher_00069', 2025, 'Changeup'),
    ]) {
      expect(parseSimulatorStart(params(href), ARSENALS)).toBeNull()
    }
  })

  it('la Ficha solo ofrece el enlace donde el Simulador tiene de donde partir', () => {
    expect(canSimulate(ARSENALS, 'pitcher_00069', 2025, 'Four-Seam')).toBe(true)
    expect(canSimulate(ARSENALS, 'pitcher_00069', 2025, 'Changeup')).toBe(false)
    expect(canSimulate(ARSENALS, 'pitcher_00069', 2024, 'Four-Seam')).toBe(false)
  })
})

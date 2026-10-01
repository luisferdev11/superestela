import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Translator } from './Translator'
import type { PitcherArsenal, PitchValues } from '@/domain/simulator'
import type { SimulateResponse } from '@/sources/simulateResponse'
import { es } from '@/i18n/es'

/**
 * La isla del Traductor con la API simulada: lo que se prueba es que arma una
 * pregunta por pitch con el origen correcto, y que pondera y dibuja lo que la
 * API contesta. El score es de la API.
 */

const FOUR_SEAM: PitchValues = {
  releaseSpeed: 92.7,
  ivb: 20.7,
  horizontalBreak: 8.2,
  extension: 6.1,
  releaseHeight: 6.0,
  releaseSide: 2.5,
  spinRate: 2386,
  spinAxis: 203,
}
const SLIDER: PitchValues = { ...FOUR_SEAM, releaseSpeed: 84, ivb: 2, horizontalBreak: -5 }
const ARSENALS: PitcherArsenal[] = [
  {
    key: 'pitcher_00069/2025',
    pitcherId: 'pitcher_00069',
    season: 2025,
    hand: 'Right',
    sea: [
      { ...FOUR_SEAM, pitchType: 'Four-Seam', usage: 0.75, n: 292, whiffPerSwing: 0.27 },
      { ...SLIDER, pitchType: 'Slider', usage: 0.25, n: 62, whiffPerSwing: 0.4 },
    ],
    hh: [],
  },
]
const m = (value: number, se: number) => ({ value, se })
const env = (name: 'sea' | 'harpHelu', stuff: number, ivb: number) => ({
  environment: name,
  densityIndex: 1,
  shape: { ivb: m(ivb, name === 'sea' ? 0 : 0.9), horizontalBreak: m(8.2, 0) },
  approach: { plateSpeed: 85, vaa: -6.1 },
  stuffPlus: m(stuff, 4),
  differentials: null,
  comparables: [],
})
const response = (sea: number, hh: number): SimulateResponse => ({
  modelId: '0.1.0+abcdef0',
  usesArsenal: false,
  stuffPlusShown: true,
  stuffPlusReason: null,
  sea: env('sea', sea, 20.7),
  harpHelu: env('harpHelu', hh, 15.6),
  altitudeDelta: { total: m(hh - sea, 3), shape: m(0, 1), environment: m(0, 1) },
  primaryFastball: 'Four-Seam',
  plausibility: { isPlausible: true, squaredDistance: 2, threshold: 28, unusual: [] },
  movementPerKrpm: { value: 9.3, percentile: 69 },
})

type Sent = { pitch: Record<string, unknown>; originDensityIndex: number }
const bodies = (): Sent[] =>
  vi.mocked(fetch).mock.calls.map((call) => {
    const body = call[1]?.body
    return JSON.parse(typeof body === 'string' ? body : '{}') as Sent
  })

const renderTranslator = () =>
  render(
    <Translator
      arsenals={ARSENALS}
      examples={['pitcher_00069/2025']}
      densities={{ sea: 1, medium: 0.903, hh: 0.858 }}
      factors={{ medium: 0.8287, hh: 0.7543 }}
    />,
  )

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      const sent = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Sent
      const body = sent.pitch.pitchType === 'Slider' ? response(110, 106) : response(114, 94)
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
    }),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400)
  })
}

describe('el Traductor', () => {
  it('pregunta una vez por pitch del arsenal real, desde el nivel del mar', async () => {
    renderTranslator()
    await settle()
    expect(bodies().map((b) => b.pitch.pitchType)).toEqual(['Four-Seam', 'Slider'])
    expect(bodies().every((b) => b.originDensityIndex === 1)).toBe(true)
  })

  it('pondera el arsenal por uso con lo que contesta la API', async () => {
    renderTranslator()
    await settle()
    // 0.75 × 94 + 0.25 × 106 = 97.0; la banda, independiente: hypot(3, 1) = 3.2.
    expect(screen.getByText('97.0 ± 3.2')).toBeInTheDocument()
    expect(screen.getAllByText('15.6 ± 0.9')).toHaveLength(2)
  })

  it('cambiar el origen vuelve a preguntar con la densidad de altitud media y avisa que extrapola', async () => {
    renderTranslator()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: es.translator.origins.medium('0.903') }))
    await settle()
    expect(bodies().at(-1)?.originDensityIndex).toBe(0.903)
    expect(screen.getByText(es.translator.extrapolation)).toBeInTheDocument()
  })

  it('una celda fuera de rango se marca y no se pregunta', async () => {
    renderTranslator()
    await settle()
    const asked = bodies().length
    fireEvent.change(screen.getByLabelText(`Four-Seam · ${es.sim.controls.releaseSpeed}`), {
      target: { value: '130' },
    })
    await settle()
    expect(bodies()).toHaveLength(asked)
    expect(screen.getByText(es.translator.editor.outOfRange)).toBeInTheDocument()
  })

  it('si la API no contesta lo dice, y la tabla sigue editable', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new Error('down')))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderTranslator()
    await settle()
    expect(screen.getByText(es.sim.status.unreachable)).toBeInTheDocument()
    expect(screen.getByLabelText(`Slider · ${es.sim.controls.ivb}`)).toBeEnabled()
  })
})

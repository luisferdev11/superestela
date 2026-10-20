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
    // Lo medido en altitud extrema: la recta cae dentro de la banda, el slider no tiene muestra.
    hh: [
      { ...FOUR_SEAM, ivb: 15.9, pitchType: 'Four-Seam', usage: 0.8, n: 243, whiffPerSwing: 0.18 },
      { ...SLIDER, pitchType: 'Slider', usage: 0.2, n: 12, whiffPerSwing: 0.3 },
    ],
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

const SUMMARY = {
  pitcherHand: 'Left',
  origin: 'medium',
  isMeasuredAtExtreme: false,
  nRows: 410,
  pitches: [
    { ...FOUR_SEAM, pitchType: 'Sinker', n: 240, usage: 0.6 },
    { ...SLIDER, pitchType: 'Changeup', n: 160, usage: 0.4 },
  ],
  unsupportedRows: 10,
  missingFeatureRows: 0,
  unsupportedTypes: ['Splitter'],
  omittedTypes: [],
}

type Sent = { pitch: Record<string, unknown>; originDensityIndex: number }
const bodies = (): Sent[] =>
  vi
    .mocked(fetch)
    .mock.calls.filter((call) => call[0] === '/api/simulate')
    .map((call) => {
      const body = call[1]?.body
      return JSON.parse(typeof body === 'string' ? body : '{}') as Sent
    })

const renderTranslator = () =>
  render(
    <Translator
      example={ARSENALS[0] ?? null}
      densities={{ sea: 1, medium: 0.903, hh: 0.858 }}
      factors={{ medium: 0.8287, hh: 0.7543 }}
    />,
  )

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/arsenals/summarize') {
        return Promise.resolve(new Response(JSON.stringify(SUMMARY), { status: 200 }))
      }
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
    // A nivel del mar no se manda el origen: es la misma pregunta que la del Simulador.
    expect(bodies().every((b) => !('originDensityIndex' in b))).toBe(true)
  })

  it('pondera el arsenal por uso con lo que contesta la API', async () => {
    renderTranslator()
    await settle()
    // 0.75 × 94 + 0.25 × 106 = 97.0. The API's SE of 4 is a 95% half-width of 7.84;
    // independent pitches: hypot(0.75, 0.25) × 7.84 = 6.2. IVB: 1.96 × 0.9 = 1.8.
    expect(screen.getByText('97.0 ± 6.2')).toBeInTheDocument()
    // Dos en la traduccion y dos en la validacion, que pone lo proyectado junto a lo medido.
    expect(screen.getAllByText('15.6 ± 1.8')).toHaveLength(4)
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

  it('un uso vacio se marca y no se pregunta, en vez de pesar todo el arsenal en cero', async () => {
    renderTranslator()
    await settle()
    const asked = bodies().length
    fireEvent.change(screen.getByLabelText(`Slider · ${es.translator.editor.usage}`), {
      target: { value: '' },
    })
    await settle()
    expect(bodies()).toHaveLength(asked)
    expect(screen.getByText(es.translator.editor.badUsage)).toBeInTheDocument()
  })

  it('tras un error no deja respuestas viejas bajo un pitch que ya cambio', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderTranslator()
    await settle()
    expect(screen.getByText('97.0 ± 6.2')).toBeInTheDocument()
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new Error('down')))
    fireEvent.change(screen.getByLabelText(`${es.translator.editor.pitch} 2`), {
      target: { value: 'Curveball' },
    })
    await settle()
    expect(screen.getByText(es.sim.status.unreachable)).toBeInTheDocument()
    expect(screen.queryByText('97.0 ± 6.2')).not.toBeInTheDocument()
  })

  it('si la API no contesta lo dice, y la tabla sigue editable', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new Error('down')))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderTranslator()
    await settle()
    expect(screen.getByText(es.sim.status.unreachable)).toBeInTheDocument()
    expect(screen.getByLabelText(`Slider · ${es.sim.controls.ivb}`)).toBeEnabled()
  })

  it('el ejemplo se presenta como validacion: lo proyectado contra lo medido en altitud extrema', async () => {
    renderTranslator()
    await settle()
    expect(screen.getByText(es.translator.example.title, { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByText('15.9')).toBeInTheDocument()
    // 12 sliders medidos no alcanzan para juzgar.
    expect(screen.getAllByText(es.translator.example.noSample).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: es.translator.example.ficha })).toHaveAttribute(
      'href',
      '/pitchers/pitcher_00069/2025',
    )
  })

  it('un export de TrackMan llena la tabla, la mano y el origen, y dice lo que quedo fuera', async () => {
    renderTranslator()
    await settle()
    const file = new File(['csv'], 'agente.csv', { type: 'text/csv' })
    await act(async () => {
      fireEvent.change(screen.getByLabelText(es.translator.upload.label), {
        target: { files: [file] },
      })
      await vi.advanceTimersByTimeAsync(0)
    })
    // Uno para leer el archivo y resumirlo, otro para el debounce de las preguntas.
    await settle()
    await settle()
    expect(
      screen.getByText(es.translator.upload.loaded('agente.csv', '400', '2')),
    ).toBeInTheDocument()
    expect(screen.getByText(es.translator.upload.unsupportedTypes('Splitter'))).toBeInTheDocument()
    const last = bodies().slice(-2)
    expect(last.map((b) => b.pitch.pitchType)).toEqual(['Sinker', 'Changeup'])
    expect(
      last.every((b) => b.pitch.pitcherHand === 'Left' && b.originDensityIndex === 0.903),
    ).toBe(true)
    // Ya no es el ejemplo: la validacion se va.
    expect(
      screen.queryByText(es.translator.example.title, { selector: 'h2' }),
    ).not.toBeInTheDocument()
  })

  it('un archivo que la API rechaza dice por que, con las columnas que faltan', async () => {
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve(
        url === '/api/arsenals/summarize'
          ? new Response(JSON.stringify({ error: 'missing_columns', columns: ['spin_rate'] }), {
              status: 422,
            })
          : new Response(JSON.stringify(response(114, 94)), { status: 200 }),
      ),
    )
    renderTranslator()
    await act(async () => {
      fireEvent.change(screen.getByLabelText(es.translator.upload.label), {
        target: { files: [new File(['x'], 'malo.csv')] },
      })
      await vi.advanceTimersByTimeAsync(0)
    })
    await settle()
    expect(
      screen.getByText(`${es.translator.upload.problems.missing_columns} spin_rate.`),
    ).toBeInTheDocument()
  })
})

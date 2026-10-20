import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Simulator } from './Simulator'
import type { Distributions, PitcherArsenal, PitchValues } from '@/domain/simulator'
import { CONTROLS, PITCH_TYPES, simulatorHref } from '@/domain/simulator'
import type { DensityScale } from '@/domain/density'
import type { MovementMaps } from '@/domain/movementMap'
import type { SimulateResponse } from '@/sources/simulateResponse'
import type { Validation } from '@/sources/simulatorSource'
import { es } from '@/i18n/es'

/**
 * La isla del Simulador con la API simulada: lo que se prueba es que la
 * pantalla arma bien la pregunta y dibuja la respuesta, no el modelo.
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
const q = { p5: 0, p50: 50, p95: 100 }
const DISTRIBUTIONS = Object.fromEntries(
  PITCH_TYPES.map((pt) => [pt, Object.fromEntries(CONTROLS.map((c) => [c, q]))]),
) as unknown as Distributions
const ARSENALS: PitcherArsenal[] = [
  {
    key: 'pitcher_00069/2025',
    pitcherId: 'pitcher_00069',
    season: 2025,
    hand: 'Right',
    sea: [
      { ...FOUR_SEAM, pitchType: 'Four-Seam', usage: 0.7, n: 292, whiffPerSwing: 0.27 },
      // Cuatro pitches no son una linea base: no debe salir como opcion.
      { ...FOUR_SEAM, pitchType: 'Changeup', usage: 0.01, n: 4, whiffPerSwing: 0.5 },
    ],
    // El Simulador parte del nivel del mar; lo medido en altura no lo toca.
    hh: [],
  },
]
const SCALE: DensityScale = {
  levels: [],
  sea: { label: 'sea', densityRatio: 1, magnusRatio: 1, nPitches: 1 },
  extreme: { label: 'ext', densityRatio: 0.858, magnusRatio: 0.754, nPitches: 1 },
}
const PANEL = {
  binIn: 2,
  meanWhiffPerSwing: 0.21,
  cells: [{ ivb: 21, horizontalBreak: 9, swings: 400, whiffPerSwing: 0.25 }],
  extremes: [],
}
const MAPS = Object.fromEntries(
  PITCH_TYPES.map((pt) => [pt, { sea: PANEL, hh: PANEL }]),
) as unknown as MovementMaps
const m = (value: number, se: number) => ({ value, se })
const env = (name: 'sea' | 'harpHelu', stuff: number) => ({
  environment: name,
  densityIndex: 1,
  shape: { ivb: m(20.7, 0), horizontalBreak: m(8.2, 0) },
  approach: { plateSpeed: 85, vaa: -6.1 },
  stuffPlus: m(stuff, 5),
  differentials: null,
  comparables: [],
})
const RESPONSE: SimulateResponse = {
  modelId: '0.1.0+abcdef0',
  usesArsenal: false,
  stuffPlusShown: true,
  stuffPlusReason: null,
  sea: env('sea', 113.7),
  harpHelu: env('harpHelu', 92.9),
  altitudeDelta: { total: m(-20.8, 6.3), shape: m(-13.5, 6.1), environment: m(-7.3, 3.6) },
  primaryFastball: 'Four-Seam',
  plausibility: { isPlausible: true, squaredDistance: 2, threshold: 28, unusual: [] },
  movementPerKrpm: { value: 9.3, percentile: 69 },
}

type Sent = { pitch: Record<string, unknown>; arsenal: unknown[] }

const bodies = (): Sent[] =>
  vi.mocked(fetch).mock.calls.map((call) => {
    const body = call[1]?.body
    return JSON.parse(typeof body === 'string' ? body : '{}') as Sent
  })

const renderSimulator = (validation: Validation | null = null) =>
  render(
    <Simulator
      distributions={DISTRIBUTIONS}
      maps={MAPS}
      arsenals={ARSENALS}
      scale={SCALE}
      validation={validation}
    />,
  )

const VALIDATION: Validation = {
  modelId: '0.1.0+abcdef0',
  usesArsenal: false,
  stuffPlusShown: true,
  passed: 10,
  total: 12,
  failed: ['F2', 'S7'],
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(RESPONSE), { status: 200 }))),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200)
  })
}

describe('el Simulador', () => {
  it('parte del pitch real del lanzador y pregunta solo con las perillas', async () => {
    renderSimulator()
    await settle()
    const [first] = bodies()
    expect(first?.pitch).toMatchObject({ pitchType: 'Four-Seam', pitcherHand: 'Right', ivb: 20.7 })
    // Uso, muestra y whiff no son perillas; la API los rechazaria.
    expect(Object.keys(first?.pitch ?? {}).sort()).toEqual(
      [...CONTROLS, 'pitchType', 'pitcherHand'].sort(),
    )
    expect(screen.getByText('113.7')).toBeInTheDocument()
  })

  it('elegir lanzador o pitch deja la seleccion en la URL', () => {
    const onPitcherChange = vi.fn()
    render(
      <Simulator
        distributions={DISTRIBUTIONS}
        maps={MAPS}
        arsenals={ARSENALS}
        scale={SCALE}
        validation={null}
        onPitcherChange={onPitcherChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Four-Seam' }))
    expect(onPitcherChange).toHaveBeenLastCalledWith(
      { pitcherKey: 'pitcher_00069/2025', pitchType: 'Four-Seam' },
      simulatorHref('pitcher_00069', 2025, 'Four-Seam'),
    )
  })

  it('no ofrece como punto de partida un pitch sin muestra', () => {
    renderSimulator()
    expect(screen.queryByRole('button', { name: 'Changeup' })).not.toBeInTheDocument()
  })

  it('mover un slider vuelve a preguntar con el valor nuevo', async () => {
    renderSimulator()
    await settle()
    fireEvent.change(screen.getByLabelText(es.sim.controls.releaseSpeed), {
      target: { value: '95' },
    })
    await settle()
    expect(bodies().at(-1)?.pitch.releaseSpeed).toBe(95)
  })

  it('en el laboratorio no hay arsenal contra el cual medir', async () => {
    renderSimulator()
    fireEvent.click(screen.getByRole('button', { name: es.sim.modes.lab }))
    await settle()
    expect(bodies().at(-1)?.arsenal).toEqual([])
    expect(bodies().at(-1)?.pitch.releaseSpeed).toBe(50)
  })

  it('si la API no contesta lo dice, en vez de dibujar un numero', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new Error('down')))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderSimulator()
    await settle()
    expect(screen.getByText(es.sim.status.unreachable)).toBeInTheDocument()
  })

  it('la procedencia cuenta las compuertas del modelo que contesto', async () => {
    renderSimulator(VALIDATION)
    await settle()
    expect(
      screen.getByText(es.sim.provenance('0.1.0+abcdef0', 10, 12, false), { exact: false }),
    ).toBeInTheDocument()
  })

  it('si contesto otro modelo, no le presta las compuertas del publicado', async () => {
    renderSimulator({ ...VALIDATION, modelId: '0.1.0+0000000' })
    await settle()
    expect(
      screen.getByText(es.sim.provenanceUnpublished('0.1.0+abcdef0'), { exact: false }),
    ).toBeInTheDocument()
  })

  it('con un lanzador, una casilla muestra u oculta los pitches mas y menos efectivos', async () => {
    renderSimulator()
    await settle()
    const box = screen.getByLabelText(es.sim.map.showExtremes)
    expect(box).toBeChecked()
    expect(screen.getByText(es.sim.map.legend.most)).toBeInTheDocument()
    fireEvent.click(box)
    expect(screen.queryByText(es.sim.map.legend.most)).toBeNull()
  })

  it('en el laboratorio no hay puntos de la liga ni casilla', async () => {
    renderSimulator()
    fireEvent.click(screen.getByRole('button', { name: es.sim.modes.lab }))
    await settle()
    expect(screen.queryByLabelText(es.sim.map.showExtremes)).toBeNull()
    expect(screen.queryByText(es.sim.map.legend.most)).toBeNull()
  })

  it('en el laboratorio, los pitches parecidos quedan en un plegable cerrado', async () => {
    const comparable = {
      pitcherId: 'pitcher_00001',
      season: 2025,
      n: 120,
      ivb: 20,
      horizontalBreak: 8,
      releaseSpeed: 93,
      whiffPerSwing: 0.25,
    }
    const withComparables = {
      ...RESPONSE,
      sea: { ...RESPONSE.sea, comparables: [comparable] },
      harpHelu: { ...RESPONSE.harpHelu, comparables: [comparable] },
    }
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(withComparables), { status: 200 })),
    )
    renderSimulator()
    fireEvent.click(screen.getByRole('button', { name: es.sim.modes.lab }))
    await settle()
    const details = screen.getByText(es.sim.comparables.toggle).closest('details')
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')
    expect(details?.textContent).toContain(es.sim.comparables.title)
  })

  it('la ayuda del mapa abre una explicacion y se cierra', async () => {
    renderSimulator()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: es.sim.map.help.open }))
    expect(screen.getByRole('dialog', { name: es.sim.map.help.title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.sim.map.help.close }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

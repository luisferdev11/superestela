import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LocationMap } from './LocationMap'
import type { LocationPanel } from '@/domain/location'
import { es } from '@/i18n/es'

const PANEL: LocationPanel = {
  nPitches: 543,
  meanPlateHeightFt: 2.64,
  plateHeightSdFt: 0.9,
  zoneShare: 0.424,
  whiffPerSwing: 0.264,
  locationPlus: { value: 101.5, se: 0.9 },
  grid: [
    [0, 1],
    [2, 4],
  ],
  sideRangeFt: [-2, 2],
  heightRangeFt: [0.5, 4.5],
}

describe('el mapa de ubicacion', () => {
  it('sin datos dibuja el marco y dice que esta pendiente, sin ninguna cifra', () => {
    const { container } = render(<LocationMap title="Nivel del mar" panel={null} max={1} />)
    expect(
      screen.getByRole('img', { name: es.ficha.location.pendingLabel('Nivel del mar') }),
    ).toBeInTheDocument()
    expect(screen.getByText(new RegExp(es.ficha.location.pending))).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d+(\.\d+)?%/)
  })

  it('con datos pinta una celda por valor y la mas densa a opacidad completa', () => {
    const { container } = render(<LocationMap title="Nivel del mar" panel={PANEL} max={4} />)
    const cells = container.querySelectorAll('rect[fill-opacity]')
    expect(cells).toHaveLength(4)
    expect(cells[3]?.getAttribute('fill-opacity')).toBe('1')
    expect(screen.getByText(es.ficha.location.stats('31.7', '42.4', '26.4'))).toBeInTheDocument()
  })

  it('dice el Location+ en grande, con su banda y que describe, no proyecta', () => {
    const { container } = render(<LocationMap title="Nivel del mar" panel={PANEL} max={4} />)
    expect(screen.getByText('101.5')).toBeInTheDocument()
    expect(container.textContent).toContain('± 0.9')
    expect(screen.getByText(es.ficha.location.locationPlusHelp)).toBeInTheDocument()
  })

  it('sin Location+ no inventa uno', () => {
    const { container } = render(
      <LocationMap title="Nivel del mar" panel={{ ...PANEL, locationPlus: null }} max={4} />,
    )
    expect(screen.getByText(es.ficha.location.locationPlusNone)).toBeInTheDocument()
    expect(container.textContent).not.toContain('101.5')
  })

  it('escribe los dos lados de la zona: el mapa es la vista del catcher', () => {
    render(<LocationMap title="Nivel del mar" panel={PANEL} max={4} />)
    expect(screen.getByText(es.ficha.location.sides.left)).toBeInTheDocument()
    expect(screen.getByText(es.ficha.location.sides.right)).toBeInTheDocument()
  })

  it('con un tipo de pitch dibuja solo ese, con su muestra y su Location+', () => {
    const focus = {
      pitch: 'Slider',
      map: {
        nPitches: 40,
        counts: [
          [0, 3],
          [1, 0],
        ],
        locationPlus: { value: 97.2, se: 2.1 },
      },
    }
    const { container } = render(
      <LocationMap title="Nivel del mar" panel={PANEL} max={1} focus={focus} />,
    )
    expect(container.querySelectorAll('rect[fill-opacity]')).toHaveLength(4)
    expect(screen.getByText(es.ficha.location.pitches(40))).toBeInTheDocument()
    expect(screen.getByText('97.2')).toBeInTheDocument()
    expect(screen.getByText(es.ficha.location.onlyType('Slider'))).toBeInTheDocument()
  })

  it('con pocos de ese tipo no dibuja un mapa y lo dice', () => {
    render(
      <LocationMap
        title="Nivel del mar"
        panel={PANEL}
        max={1}
        focus={{ pitch: 'Cutter', map: null }}
      />,
    )
    expect(screen.getByText(es.ficha.location.fewOfType('Cutter'))).toBeInTheDocument()
    expect(screen.getByText(es.ficha.location.locationPlusNone)).toBeInTheDocument()
  })
})

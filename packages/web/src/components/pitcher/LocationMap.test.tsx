import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LocationMap } from './LocationMap'
import type { LocationPanel } from '@/domain/location'
import { es } from '@/i18n/es'

const PANEL: LocationPanel = {
  nPitches: 543,
  meanPlateHeightFt: 2.64,
  zoneShare: 0.424,
  whiffPerSwing: 0.264,
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
    expect(screen.getByText(es.ficha.location.stats('2.64', '42.4', '26.4'))).toBeInTheDocument()
  })
})

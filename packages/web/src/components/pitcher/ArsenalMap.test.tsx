import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArsenalMap } from './ArsenalMap'
import type { MapPitch } from '@/domain/arsenalMap'
import { es } from '@/i18n/es'

const PITCHES: MapPitch[] = [
  {
    pitchType: 'Four-Seam',
    usage: 0.673,
    sea: { ivb: 20.7, hb: 8.17 },
    hh: { ivb: 15, hb: 5.2 },
    league: { ivb: 17.1, hb: 9.45 },
  },
  // Solo con muestra en altura: se dibuja el punto, sin flecha.
  { pitchType: 'Changeup', usage: 0.05, sea: null, hh: { ivb: 6, hb: 12 }, league: null },
]

describe('el mapa de movimiento del arsenal', () => {
  it('lee cada pitch en los dos entornos, tambien para un lector de pantalla', () => {
    render(<ArsenalMap pitches={PITCHES} />)
    const map = screen.getByRole('img')
    expect(map.getAttribute('aria-label')).toContain(
      es.ficha.map.label('Four-Seam', '20.7″ IVB, 8.2″ HB', '15.0″ IVB, 5.2″ HB'),
    )
    expect(map.getAttribute('aria-label')).toContain(es.ficha.map.none)
  })

  it('una flecha solo donde hay forma en los dos entornos', () => {
    const { container } = render(<ArsenalMap pitches={PITCHES} />)
    expect(container.querySelectorAll('line[marker-end]')).toHaveLength(1)
  })
})

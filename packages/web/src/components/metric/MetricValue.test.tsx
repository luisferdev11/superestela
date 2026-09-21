import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MetricValue } from './MetricValue'
import { es } from '@/i18n/es'

/**
 * `README`, regla 3: ningun score sin su banda. Este archivo es esa regla
 * ejecutada, en dos niveles.
 */

describe('MetricValue', () => {
  it('muestra el valor con su banda', () => {
    render(<MetricValue metric={{ value: 92.0, se: 0.7 }} />)
    expect(screen.getByText('92.0')).toBeInTheDocument()
    expect(screen.getByLabelText('92.0 ± 0.7')).toBeInTheDocument()
  })

  it('no acepta un valor sin banda: el compilador lo impide', () => {
    // @ts-expect-error `se` es obligatorio. Si alguien lo vuelve opcional, esta
    // directiva queda sin usar y `pnpm typecheck` falla. La regla la sostiene
    // el compilador, no la disciplina.
    render(<MetricValue metric={{ value: 92.0 }} />)
  })

  it('con banda no finita dice "no concluyente", nunca un numero', () => {
    render(<MetricValue metric={{ value: 92.0, se: Number.NaN }} />)
    expect(screen.getByText(es.inconclusive)).toBeInTheDocument()
    expect(screen.queryByText(/\d/)).toBeNull()
  })

  it('con metric nulo dice "no concluyente", nunca un numero', () => {
    const { container } = render(<MetricValue metric={null} />)
    expect(screen.getByText(es.inconclusive)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d/)
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RateValue } from './RateValue'
import { es } from '@/i18n/es'

describe('una tasa descriptiva', () => {
  it('con muestra suficiente, el numero con su banda y sin marca', () => {
    render(<RateValue metric={{ value: 24.5, se: 3.1 }} />)
    expect(screen.getByLabelText('24.5 ± 3.1')).toBeInTheDocument()
    expect(screen.queryByLabelText(es.smallSample)).toBeNull()
  })

  it('debajo del minimo da el numero igual, marcado con «*» (20 oct)', () => {
    const { container } = render(<RateValue metric={{ value: 11.8, se: 26.1 }} small />)
    expect(screen.getByLabelText('11.8 ± 26.1')).toBeInTheDocument()
    expect(screen.getByLabelText(es.smallSample)).toHaveTextContent('*')
    expect(container.textContent).not.toContain(es.insufficientSample)
  })

  it('sin denominador no hay numero que dar', () => {
    render(<RateValue metric={null} />)
    expect(screen.getByText(es.insufficientSample)).toBeInTheDocument()
  })
})

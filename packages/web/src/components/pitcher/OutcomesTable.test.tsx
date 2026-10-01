import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OutcomesTable } from './OutcomesTable'
import type { Outcomes, SeasonEntry } from '@/domain/types'
import { es } from '@/i18n/es'

const m = (value: number, se: number) => ({ value, se })
const rich: Outcomes = {
  plateAppearances: 132,
  swings: 240,
  kPct: m(24.2, 7.3),
  bbPct: m(7.6, 4.5),
  kMinusBbPct: m(16.7, 8.4),
  whiffPerSwing: m(28.3, 5.7),
}
const thin: Outcomes = {
  plateAppearances: 31,
  swings: 44,
  kPct: null,
  bbPct: null,
  kMinusBbPct: null,
  whiffPerSwing: null,
}
const ENTRY: SeasonEntry = {
  season: 2025,
  nPitchesHh: 520,
  nPitchesSea: 130,
  scored: true,
  outcomesHh: rich,
  outcomesSea: thin,
}

describe('la tabla de ponches de la Ficha', () => {
  it('da cada tasa con su banda en el entorno con muestra', () => {
    render(<OutcomesTable entries={[ENTRY]} league={null} />)
    expect(screen.getByText('16.7')).toBeInTheDocument()
    expect(screen.getByLabelText('16.7 ± 8.4')).toBeInTheDocument()
  })

  it('debajo del minimo dice muestra insuficiente, no un numero', () => {
    render(<OutcomesTable entries={[ENTRY]} league={null} />)
    expect(screen.getAllByText(es.insufficientSample)).toHaveLength(4)
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('pone la liga de cada entorno como referencia', () => {
    render(<OutcomesTable entries={[ENTRY]} league={{ hh: rich, sea: rich }} />)
    expect(
      screen.getByText(es.ficha.outcomes.league('altitud extrema', '16.7', '28.3')),
    ).toBeInTheDocument()
  })
})

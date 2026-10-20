import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManyPitchers } from './ManyPitchers'
import { TranslatorModes } from './TranslatorModes'
import { formatMetric } from '@/domain/format'
import { es } from '@/i18n/es'

/** El Traductor con varios lanzadores, con la API simulada: la tabla, el orden y lo que se dice. */

const m = (value: number, se: number) => ({ value, se })
const pitcher = (id: string, hh: number, hand: 'Right' | 'Left' = 'Right') => ({
  pitcherId: id,
  pitcherHand: hand,
  n: 150,
  stuffPlusSea: m(hh + 10, 1),
  stuffPlusHh: m(hh, 1),
  altitudeDelta: m(-10, 0.5),
  projectedTax: m(1.5, 0.4),
  whiffPerSwing: { value: 0.25, ci95: 0.05 },
  swings: 80,
})
const SCORES = {
  modelId: '0.1.0+abcdef0',
  stuffPlusShown: true,
  stuffPlusReason: null,
  nRows: 900,
  pitchers: [pitcher('liga_a', 92), pitcher('liga_b', 104, 'Left'), pitcher('liga_c', 98)],
  fewPitches: 2,
  minPitches: 100,
  unsupportedRows: 10,
  missingFeatureRows: 0,
  hasSwings: true,
  taxValidation: { n: 370, pearsonR: 0.142, meanProjected: 1.87, meanMeasured: 1.53 },
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(SCORES), { status: 200 }))),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const upload = async () => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(es.translator.many.upload), {
      target: { files: [new File(['csv'], 'liga.csv')] },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

const firstRowId = (): string => document.querySelector('tbody tr td')?.textContent ?? ''

describe('el Traductor con varios lanzadores', () => {
  it('un archivo da una fila por lanzador, del mejor en altitud al peor', async () => {
    render(<ManyPitchers />)
    await upload()
    expect(
      screen.getByText(es.translator.many.summary(3, (900).toLocaleString('es-MX'))),
    ).toBeInTheDocument()
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3)
    expect(firstRowId()).toBe('liga_b')
  })

  it('un clic en Pitcher ordena por nombre, y otro lo invierte', async () => {
    render(<ManyPitchers />)
    await upload()
    fireEvent.click(screen.getByRole('button', { name: /^Pitcher/ }))
    expect(firstRowId()).toBe('liga_a')
    fireEvent.click(screen.getByRole('button', { name: /^Pitcher/ }))
    expect(firstRowId()).toBe('liga_c')
  })

  it('dice que el impuesto es proyectado, con la revision contra el medido', async () => {
    render(<ManyPitchers />)
    await upload()
    expect(
      screen.getByText(es.translator.many.taxNote(370, '0.14', '1.87', '1.53')),
    ).toBeInTheDocument()
  })

  it('el whiff lleva su banda al 95%, como promete la nota', async () => {
    render(<ManyPitchers />)
    await upload()
    expect(screen.getAllByLabelText(formatMetric({ value: 25, se: 5 }))).toHaveLength(3)
  })

  it('tras un archivo que falla, la tabla anterior se va y el motivo es el del archivo', async () => {
    render(<ManyPitchers />)
    await upload()
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3)
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ detail: [] }), { status: 422 })),
    )
    await upload()
    expect(document.querySelectorAll('tbody tr')).toHaveLength(0)
    expect(screen.getByText(es.translator.upload.problems.unreadable)).toBeInTheDocument()
  })

  it('filtra por mano', async () => {
    render(<ManyPitchers />)
    await upload()
    fireEvent.change(screen.getByLabelText(es.translator.many.hand), { target: { value: 'Left' } })
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('los dos modos conviven: se elige arriba', () => {
    render(<TranslatorModes single={<p>un lanzador</p>} />)
    expect(screen.getByText('un lanzador')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: es.translator.modes.many }))
    expect(screen.getByLabelText(es.translator.many.upload)).toBeInTheDocument()
  })
})

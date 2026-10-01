import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RadarGuide } from './RadarGuide'
import { MIN_PITCHES_FOR_SCORE, MIN_PLATE_APPEARANCES_FOR_RATE } from '@/domain/constants'
import { es } from '@/i18n/es'

describe('como leer el Radar', () => {
  it('se abre desde su titulo y explica cada termino', () => {
    render(<RadarGuide />)
    fireEvent.click(screen.getByText(es.guide.title))
    for (const item of es.guide.items) expect(screen.getByText(item.term)).toBeInTheDocument()
  })

  it('los minimos que cita son los del contrato, no escritos a mano', () => {
    render(<RadarGuide />)
    expect(
      screen.getByText(
        es.guide.insufficientText(MIN_PITCHES_FOR_SCORE, MIN_PLATE_APPEARANCES_FOR_RATE),
      ),
    ).toBeInTheDocument()
  })

  it('cada columna del Radar tiene su explicacion', () => {
    expect(es.columnHelp).toHaveLength(es.columns.length)
  })
})

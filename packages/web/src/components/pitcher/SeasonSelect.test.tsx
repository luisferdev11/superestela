import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Route } from 'next'
import { SeasonSelect, type SeasonOption } from './SeasonSelect'
import { MIN_PITCHES_FOR_SCORE } from '@/domain/constants'
import { es } from '@/i18n/es'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const scored = (season: number): SeasonOption => ({
  season,
  href: `/pitchers/p/${String(season)}` as Route,
  sample: null,
})
const unscored = (season: number, hh: number, sea: number): SeasonOption => ({
  season,
  href: null,
  sample: { hh, sea },
})

describe('el selector de temporada', () => {
  it('con una sola temporada con score, lista las demas sin score y dice por que', () => {
    render(
      <SeasonSelect
        current={2025}
        options={[unscored(2026, 18, 59), scored(2025), unscored(2024, 87, 484)]}
      />,
    )
    const select = screen.getByRole('combobox')
    expect(select).not.toBeDisabled()
    const label = es.ficha.seasonWithoutScore(2024, 87, 484, MIN_PITCHES_FOR_SCORE)
    expect(screen.getByRole('option', { name: label })).toBeDisabled()
    expect(screen.getByText(es.ficha.otherSeasonsWithoutScore)).toBeInTheDocument()
  })

  it('nunca navega a una temporada sin score', () => {
    push.mockClear()
    render(<SeasonSelect current={2025} options={[scored(2025), unscored(2024, 87, 484)]} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2024' } })
    expect(push).not.toHaveBeenCalled()
  })

  it('con varias temporadas con score, lleva a la elegida', () => {
    push.mockClear()
    render(<SeasonSelect current={2025} options={[scored(2026), scored(2025)]} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2026' } })
    expect(push).toHaveBeenCalledWith('/pitchers/p/2026')
  })

  it('si de verdad lanzo una sola temporada, el control lo dice', () => {
    render(<SeasonSelect current={2025} options={[scored(2025)]} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByText(es.ficha.onlySeason)).toBeInTheDocument()
  })
})

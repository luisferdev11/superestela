import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Plantel } from './Plantel'
import { approximateRoster, rosterRows } from '@/domain/roster'
import { loadDataset } from '@/sources/mockupSource'
import { es } from '@/i18n/es'

vi.mock('server-only', () => ({}))

const props = async () => {
  const { cards, seasonsByPitcher } = await loadDataset()
  const ids = approximateRoster(seasonsByPitcher, 2026)
  return {
    ids,
    cards,
    seasonsByPitcher,
    seasons: Object.fromEntries(ids.map((id) => [id, seasonsByPitcher.get(id) ?? []])),
  }
}

describe('el plantel', () => {
  it('cuenta las temporadas con y sin score, y cada una con score lleva a su Ficha', async () => {
    const p = await props()
    render(<Plantel ids={p.ids} cards={p.cards} seasons={p.seasons} latestSeason={2026} />)
    const rows = rosterRows(p.ids, p.cards, p.seasonsByPitcher, 'role')
    const scored = rows.filter((r) => r.card !== null)
    expect(
      screen.getByText(
        es.plantel.summary(scored.length, rows.length - scored.length, p.ids.length),
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(scored.length)
  })

  it('«Todos» ordena por lanzador sin agrupar por rol', async () => {
    const p = await props()
    render(<Plantel ids={p.ids} cards={p.cards} seasons={p.seasons} latestSeason={2026} />)
    fireEvent.click(screen.getByRole('button', { name: es.plantel.groupings.all }))
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td')?.textContent?.trim().split(' ')[0] ?? '')
    expect(names).toEqual([...names].sort())
  })
})

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Deployment } from './Deployment'
import { approximateRoster, latestCards } from '@/domain/roster'
import { loadDataset } from '@/sources/mockupSource'
import { es } from '@/i18n/es'

vi.mock('server-only', () => ({}))

const roster = async () => {
  const { cards, seasonsByPitcher } = await loadDataset()
  return latestCards(cards, approximateRoster(seasonsByPitcher, 2026))
}

const firstStarter = () => {
  const group = screen.getByRole('heading', { name: es.rolePlural.starter }).closest('section')
  if (group === null) throw new Error('sin grupo de abridores')
  return within(group).getAllByRole('listitem')[0]?.textContent ?? ''
}

describe('el tablero de despliegue', () => {
  it('cambiar de estadio reordena los grupos por el Stuff+ de ese entorno', async () => {
    const cards = await roster()
    const best = (env: 'hh' | 'sea') =>
      [...cards]
        .filter((c) => c.role === 'starter')
        .sort((a, b) =>
          env === 'hh'
            ? b.stuffPlusHh.value - a.stuffPlusHh.value
            : b.stuffPlusSea.value - a.stuffPlusSea.value,
        )[0]?.pitcherId ?? ''
    render(
      <Deployment cards={cards} latestSeason={2026} densities={{ hh: '0.858', sea: '1.000' }} />,
    )
    expect(firstStarter()).toContain(best('hh'))
    fireEvent.click(screen.getByRole('button', { name: es.deploy.envs.sea('1.000') }))
    expect(firstStarter()).toContain(best('sea'))
  })

  it('cada lanzador lleva a su Ficha', async () => {
    const cards = await roster()
    render(
      <Deployment cards={cards} latestSeason={2026} densities={{ hh: '0.858', sea: '1.000' }} />,
    )
    const card = cards[0]
    if (card === undefined) throw new Error('plantel vacio')
    const links = screen.getAllByRole('link', { name: card.pitcherId })
    expect(links[0]?.getAttribute('href')).toBe(
      `/pitchers/${card.pitcherId}/${String(card.season)}`,
    )
  })
})

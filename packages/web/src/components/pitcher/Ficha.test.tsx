import { readFile } from 'node:fs/promises'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PitcherHeader } from './PitcherHeader'
import { PitcherKpis } from './PitcherKpis'
import { SeasonTable } from './SeasonTable'
import { cardsOf, fichaHref, pickSeason, seasonTimeline } from '@/domain/pitcher'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { es } from '@/i18n/es'

/** Los componentes de la Ficha con las tarjetas reales, no con un fixture. */
const load = async (pitcherId: string) => {
  const parsed = mockupDataSchema.parse(JSON.parse(await readFile(mockupDataPath(), 'utf8')))
  const own = cardsOf(parsed.pitchers.map(toPitcherSeason), pitcherId)
  const card = pickSeason(own)
  if (card === null) throw new Error(`${pitcherId} no tiene tarjeta`)
  const entries = (parsed.pitcher_seasons[pitcherId] ?? []).map(toSeasonEntry)
  return { own, card, rows: seasonTimeline(entries, own) }
}

describe('la Ficha de pitcher_00069', () => {
  it('abre con su temporada, su rol y la Trampa, y solo Resumen es enlace', async () => {
    const { own, card } = await load('pitcher_00069')
    render(
      <PitcherHeader
        card={card}
        seasons={own.map((c) => c.season)}
        tab="summary"
        tabHrefs={{ summary: fichaHref(card.pitcherId, card.season) }}
      />,
    )
    expect(
      screen.getByRole('heading', { name: es.ficha.heading('pitcher_00069', 2025) }),
    ).toBeInTheDocument()
    expect(screen.getByText(es.role.starter)).toBeInTheDocument()
    expect(screen.getByText(es.trap)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.ficha.tabs.summary })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: es.ficha.tabs.plan })).toBeNull()
  })

  it('el impuesto dice no concluyente y ademas cuanto midio', async () => {
    const { card } = await load('pitcher_00069')
    render(<PitcherKpis card={card} rank={{ sea: 1, hh: 1, of: 1 }} />)
    expect(screen.getByLabelText('93.3 ± 0.7')).toBeInTheDocument()
    expect(screen.getByLabelText('110.5 ± 0.8')).toBeInTheDocument()
    expect(screen.getByText(es.ficha.kpi.taxMeasured('+4.55 ± 2.70'))).toBeInTheDocument()
  })
})

describe('el hueco en la tabla de temporadas', () => {
  it('pitcher_00076 muestra 2025 como no lanzo, con la frase que lo explica', async () => {
    const { rows } = await load('pitcher_00076')
    render(<SeasonTable rows={rows} pitchersWithGap={28} />)
    expect(screen.getByText(es.ficha.seasons.status.absent)).toBeInTheDocument()
    expect(screen.getByText(es.ficha.seasons.gap(2025))).toBeInTheDocument()
    expect(screen.getByText(es.ficha.seasons.gapContext(28))).toBeInTheDocument()
  })
})

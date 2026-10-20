import { readFile } from 'node:fs/promises'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PitcherHeader } from './PitcherHeader'
import { PitcherKpis } from './PitcherKpis'
import { PitcherReading } from './PitcherReading'
import { SeasonTable } from './SeasonTable'
import { cardsOf, fichaHref, pickSeason, seasonTimeline } from '@/domain/pitcher'
import { mockupDataPath } from '@/sources/paths'
import { loadPitcherRuns } from '@/sources/runsSource'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { es } from '@/i18n/es'

// El selector de temporada navega con el router de Next; aqui no hay app router montado.
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

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
  it('abre con su temporada, su rol y si sufre en la altura, y solo Resumen es enlace', async () => {
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

  it('el selector de temporada ofrece solo sus temporadas con score y lleva a la misma pestana', async () => {
    const { card: base } = await load('pitcher_00069')
    render(
      <PitcherHeader
        card={base}
        seasons={[2024, 2026, 2025]}
        tab="projection"
        tabHrefs={{ summary: fichaHref(base.pitcherId, base.season) }}
      />,
    )
    const select = screen.getByLabelText(es.ficha.season)
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      '2026',
      '2025',
      '2024',
    ])
    fireEvent.change(select, { target: { value: '2024' } })
    expect(push).toHaveBeenCalledWith(`/proyeccion/${base.pitcherId}/2024`)
  })

  it('el impuesto dice no concluyente y ademas cuanto midio', async () => {
    const { card } = await load('pitcher_00069')
    render(<PitcherKpis card={card} rank={{ sea: 1, hh: 1, of: 1 }} />)
    expect(screen.getByLabelText('93.3 ± 0.7')).toBeInTheDocument()
    expect(screen.getByLabelText('110.5 ± 0.8')).toBeInTheDocument()
    expect(screen.getByText(es.ficha.kpi.taxMeasured('+4.55 ± 5.29'))).toBeInTheDocument()
  })
})

describe('las carreras permitidas de pitcher_00069 (RA/9, no ERA)', () => {
  it('muestra el RA/9 en los dos entornos con su banda, y dice por que no es ERA', async () => {
    const { card } = await load('pitcher_00069')
    const runs = await loadPitcherRuns()
    expect(runs).not.toBeNull()
    render(
      <PitcherKpis
        card={card}
        rank={{ sea: 1, hh: 1, of: 1 }}
        runs={{
          minInnings: runs?.minInnings ?? 10,
          pitcher: runs?.byKey.get(`pitcher_00069/${String(card.season)}`) ?? null,
        }}
      />,
    )
    expect(screen.getByText(es.ficha.kpi.runs)).toBeInTheDocument()
    expect(screen.getByText(es.ficha.kpi.runsNote(10))).toBeInTheDocument()
    // analysis/outputs/pitcher_runs.json: 7.13 en altura, 3.20 a nivel del mar.
    expect(screen.getByLabelText('7.13 ± 3.87')).toBeInTheDocument()
    expect(screen.getByLabelText('3.20 ± 2.20')).toBeInTheDocument()
  })

  it('junto al RA/9, el impuesto dice que mide otra cosa', async () => {
    const { card } = await load('pitcher_00069')
    render(
      <PitcherKpis
        card={card}
        rank={{ sea: 1, hh: 1, of: 1 }}
        runs={{ minInnings: 10, pitcher: null }}
      />,
    )
    expect(
      screen.getByText(`${es.ficha.kpi.taxMeasured('+4.55 ± 5.29')} ${es.ficha.kpi.taxDefinition}`),
    ).toBeInTheDocument()
  })

  it('sin el artefacto, la Ficha no muestra el recuadro', async () => {
    const { card } = await load('pitcher_00069')
    render(<PitcherKpis card={card} rank={{ sea: 1, hh: 1, of: 1 }} runs={null} />)
    expect(screen.queryByText(es.ficha.kpi.runs)).toBeNull()
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

describe('la lectura del sistema', () => {
  it('pitcher_00069: no al precio de nivel del mar, la palanca es el slider, y la regla se declara', async () => {
    const { card } = await load('pitcher_00069')
    render(<PitcherReading card={card} />)
    expect(screen.getByText(es.ficha.reading.verdict.notAtSeaLevelPrice)).toBeInTheDocument()
    expect(
      screen.getByText(es.ficha.reading.lever('Slider', '−1.7 ± 1.3', 'Four-Seam', '−20.6 ± 1.1')),
    ).toBeInTheDocument()
    expect(screen.getByText(es.ficha.reading.rule)).toBeInTheDocument()
  })
})

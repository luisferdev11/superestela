import { readFile } from 'node:fs/promises'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RadarTable } from './RadarTable'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { selectRadarCohort, summarize } from '@/domain/cohort'
import { formatMetric } from '@/domain/format'
import { MIN_PLATE_APPEARANCES_FOR_RATE } from '@/domain/constants'
import { loadLocations } from '@/sources/locationSource'
import { es } from '@/i18n/es'

vi.mock('server-only', () => ({}))

/**
 * La tabla del Radar como la usa un scout: ordenar con un clic en el
 * encabezado, invertir con otro, y filtrar con menus (14 de octubre).
 */

const cohort = async () => {
  const parsed = mockupDataSchema.parse(JSON.parse(await readFile(mockupDataPath(), 'utf8')))
  return selectRadarCohort(
    parsed.pitchers.map(toPitcherSeason),
    new Map(
      Object.entries(parsed.pitcher_seasons).map(([id, seasons]) => [
        id,
        seasons.map(toSeasonEntry),
      ]),
    ),
    await loadLocations(),
  )
}

const renderTable = async () => {
  const cards = await cohort()
  render(<RadarTable cards={cards} latestSeason={2026} cohortSummary={summarize(cards)} />)
  return cards
}

// Leer la primera fila directo del DOM: buscar por rol entre ~300 filas es lento.
const firstRowId = (): string => document.querySelector('tbody tr td a')?.textContent ?? ''

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const header = (name: string) =>
  screen.getByRole('button', { name: new RegExp(name.startsWith('^') ? name : escape(name)) })

// Montar ~300 filas tarda: mas margen que el de 5 s por defecto.
describe('la tabla del Radar', { timeout: 30_000 }, () => {
  it('ordena por la columna pulsada, y un segundo clic invierte', async () => {
    const cards = await renderTable()
    fireEvent.click(header('^Pitcher'))
    const sortedIds = cards.map((c) => c.pitcherId).sort((a, b) => a.localeCompare(b, 'es'))
    expect(firstRowId()).toBe(sortedIds[0])
    expect(screen.getByRole('columnheader', { name: /^Pitcher/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    fireEvent.click(header('^Pitcher'))
    expect(firstRowId()).toBe(sortedIds.at(-1))
  })

  it('Location+ de mayor a menor deja arriba el Location+ mas alto', async () => {
    const cards = await renderTable()
    fireEvent.click(header('Location+'))
    const best = Math.max(
      ...cards.flatMap((c) => (c.locationPlusHh ? [c.locationPlusHh.value] : [])),
    )
    const top = cards.find((c) => c.pitcherId === firstRowId())
    expect(top?.locationPlusHh?.value).toBe(best)
  })

  it('el filtro de Location+ deja solo a los de 100 o mas', async () => {
    const cards = await renderTable()
    fireEvent.change(screen.getByLabelText(es.filterBar.locationPlus), {
      target: { value: 'above' },
    })
    const above = cards.filter((c) => c.locationPlusHh !== null && c.locationPlusHh.value >= 100)
    expect(above.length).toBeGreaterThan(0)
    expect(screen.getByText(es.filterBar.results(above.length, cards.length))).toBeInTheDocument()
  })

  it('con un tipo de pitch, todos los que lo tiran y las columnas de ese pitch', async () => {
    const cards = await renderTable()
    fireEvent.change(screen.getByLabelText(es.filterBar.pitch), { target: { value: 'Slider' } })
    const throwers = cards.filter((c) => c.arsenal.some((e) => e.pitch === 'Slider'))
    expect(
      screen.getByText(es.filterBar.results(throwers.length, cards.length)),
    ).toBeInTheDocument()
    expect(header(es.pitchColumns.hh('Slider'))).toBeInTheDocument()
    expect(screen.getByText(es.filterBar.pitchNote('Slider'))).toBeInTheDocument()
  })

  it('«Limpiar filtros» devuelve a todos', async () => {
    const cards = await renderTable()
    fireEvent.click(screen.getByLabelText(es.trapsOnly))
    expect(screen.queryByText(es.filterBar.results(cards.length, cards.length))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: es.filterBar.clear }))
    expect(screen.getByText(es.filterBar.results(cards.length, cards.length))).toBeInTheDocument()
  })

  it('las tasas de una fila son las de la Ficha; con muestra chica, se dan con «*»', async () => {
    const cards = await renderTable()
    const thin = cards.find(
      (c) =>
        c.ratesHh.kMinusBbPct !== null &&
        c.ratesHh.plateAppearances < MIN_PLATE_APPEARANCES_FOR_RATE,
    )
    if (thin?.ratesHh.kMinusBbPct == null) throw new Error('falta un caso con muestra corta')
    fireEvent.change(screen.getByLabelText(es.filterBar.search), {
      target: { value: thin.pitcherId },
    })
    const row = within(document.querySelector('tbody tr') as HTMLElement)
    expect(row.getByLabelText(formatMetric(thin.ratesHh.kMinusBbPct))).toBeInTheDocument()
    expect(row.getAllByLabelText(es.smallSample).length).toBeGreaterThan(0)
  })

  it('el Stuff+ a nivel del mar lleva su banda, como el de altitud extrema', async () => {
    const cards = await renderTable()
    const [first] = cards
    if (first === undefined) throw new Error('cohorte vacia')
    fireEvent.change(screen.getByLabelText(es.filterBar.search), {
      target: { value: first.pitcherId },
    })
    const row = document.querySelector('tbody tr') as HTMLElement
    expect(within(row).getByLabelText(formatMetric(first.stuffPlusSea))).toBeInTheDocument()
  })

  it('ya no muestra la columna del Impuesto (20 oct)', async () => {
    await renderTable()
    expect(screen.queryByRole('button', { name: /Impuesto/ })).toBeNull()
  })
})

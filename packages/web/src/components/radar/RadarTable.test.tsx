import { readFile } from 'node:fs/promises'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RadarTable } from './RadarTable'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { selectRadarCohort, summarize } from '@/domain/cohort'
import { es } from '@/i18n/es'

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

  it('el impuesto de mayor a menor deja arriba un impuesto concluyente', async () => {
    const cards = await renderTable()
    fireEvent.click(header('Impuesto'))
    const top = cards.find((c) => c.pitcherId === firstRowId())
    expect(top?.altitudeTax).not.toBeNull()
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

  it('explica el Impuesto de Altitud en pantalla', async () => {
    await renderTable()
    expect(screen.getByText(es.taxExplainer)).toBeInTheDocument()
  })
})

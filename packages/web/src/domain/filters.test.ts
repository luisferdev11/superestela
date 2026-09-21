import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { selectRadarCohort } from './cohort'
import { dominantPitch, dominantPitchTypes } from './arsenal'
import {
  applyFilters,
  availableSeasons,
  availableThrows,
  countWith,
  isFiltered,
  NO_FILTERS,
  toggleValue,
} from './filters'

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

describe('los filtros del radar', () => {
  it('sin filtros no quita a nadie', async () => {
    const cards = await cohort()
    expect(isFiltered(NO_FILTERS)).toBe(false)
    expect(applyFilters(cards, NO_FILTERS)).toHaveLength(cards.length)
  })

  it('cada filtro por separado deja solo lo que cumple', async () => {
    const cards = await cohort()
    const season = availableSeasons(cards)[0] ?? 0
    const hand = availableThrows(cards)[0] ?? ''
    const pitch = dominantPitchTypes(cards)[0] ?? ''

    expect(
      applyFilters(cards, { ...NO_FILTERS, season: [season] }).every((c) => c.season === season),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, throws: [hand] }).every((c) => c.throws === hand),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, role: ['starter'] }).every((c) => c.role === 'starter'),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, pitch: [pitch] }).every(
        (c) => dominantPitch(c)?.pitch === pitch,
      ),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, trapsOnly: true }).every((c) => c.altitudeTrap),
    ).toBe(true)
  })

  it('dentro de una categoria los valores se suman: es "o", no "y"', async () => {
    const cards = await cohort()
    const seasons = availableSeasons(cards)
    const [a, b] = seasons
    expect(a).toBeDefined()
    expect(b).toBeDefined()

    const justA = applyFilters(cards, { ...NO_FILTERS, season: [a ?? 0] })
    const justB = applyFilters(cards, { ...NO_FILTERS, season: [b ?? 0] })
    const both = applyFilters(cards, { ...NO_FILTERS, season: [a ?? 0, b ?? 0] })

    // Sumar un valor a una categoria AMPLIA el resultado; nunca lo reduce.
    expect(both).toHaveLength(justA.length + justB.length)
    expect(both.length).toBeGreaterThan(justA.length)
  })

  it('entre categorias los filtros se multiplican: es "y"', async () => {
    const cards = await cohort()
    const one = applyFilters(cards, { ...NO_FILTERS, role: ['reliever'] })
    const two = applyFilters(cards, { ...NO_FILTERS, role: ['reliever'], trapsOnly: true })
    expect(two.length).toBeLessThanOrEqual(one.length)
    expect(two.every((c) => c.role === 'reliever' && c.altitudeTrap)).toBe(true)
  })

  it('la pregunta que antes no se podia hacer: zurdos con slider en 2024 o 2025', async () => {
    const cards = await cohort()
    const result = applyFilters(cards, {
      ...NO_FILTERS,
      throws: ['Left'],
      pitch: ['Slider'],
      season: [2024, 2025],
    })
    expect(
      result.every(
        (c) =>
          c.throws === 'Left' &&
          dominantPitch(c)?.pitch === 'Slider' &&
          [2024, 2025].includes(c.season),
      ),
    ).toBe(true)
  })

  it('alternar un valor dos veces devuelve el estado original', () => {
    const once = toggleValue(NO_FILTERS, 'season', 2025)
    expect(once.season).toEqual([2025])
    expect(toggleValue(once, 'season', 2025).season).toEqual([])
  })

  it('el conteo de un chip es exactamente lo que pasaria al pulsarlo', async () => {
    const cards = await cohort()
    const base = { ...NO_FILTERS, throws: ['Right'] }
    for (const season of availableSeasons(cards)) {
      expect(countWith(cards, base, 'season', season)).toBe(
        applyFilters(cards, toggleValue(base, 'season', season)).length,
      )
    }
  })

  it('solo ofrece filtros que devuelven algo', async () => {
    const cards = await cohort()
    for (const season of availableSeasons(cards)) {
      expect(applyFilters(cards, { ...NO_FILTERS, season: [season] }).length).toBeGreaterThan(0)
    }
    for (const pitch of dominantPitchTypes(cards)) {
      expect(applyFilters(cards, { ...NO_FILTERS, pitch: [pitch] }).length).toBeGreaterThan(0)
    }
  })
})

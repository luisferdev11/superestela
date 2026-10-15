import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { selectRadarCohort } from './cohort'
import { dominantPitch } from './arsenal'
import {
  applyFilters,
  availablePitches,
  availableSeasons,
  availableThrows,
  isFiltered,
  NO_FILTERS,
  throwsPitch,
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

    expect(applyFilters(cards, { ...NO_FILTERS, season }).every((c) => c.season === season)).toBe(
      true,
    )
    expect(
      applyFilters(cards, { ...NO_FILTERS, throws: hand }).every((c) => c.throws === hand),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, role: 'starter' }).every((c) => c.role === 'starter'),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, trapsOnly: true }).every((c) => c.altitudeTrap),
    ).toBe(true)
  })

  it('el tipo de pitch deja a todos los que lo tiran, no solo a quien lo tiene de principal', async () => {
    const cards = await cohort()
    const sliders = applyFilters(cards, { ...NO_FILTERS, pitch: 'Slider' })
    expect(sliders.every((c) => throwsPitch(c, 'Slider'))).toBe(true)
    const asMain = sliders.filter((c) => dominantPitch(c)?.pitch === 'Slider')
    // Muchos mas tiran slider que los que lo tienen de pitch principal.
    expect(sliders.length).toBeGreaterThan(asMain.length)
  })

  it('entre categorias los filtros se multiplican: es "y"', async () => {
    const cards = await cohort()
    const one = applyFilters(cards, { ...NO_FILTERS, role: 'reliever' })
    const two = applyFilters(cards, { ...NO_FILTERS, role: 'reliever', trapsOnly: true })
    expect(two.length).toBeLessThanOrEqual(one.length)
    expect(two.every((c) => c.role === 'reliever' && c.altitudeTrap)).toBe(true)
  })

  it('zurdos que tiran slider', async () => {
    const cards = await cohort()
    const result = applyFilters(cards, { ...NO_FILTERS, throws: 'Left', pitch: 'Slider' })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((c) => c.throws === 'Left' && throwsPitch(c, 'Slider'))).toBe(true)
  })

  it('el buscador encuentra por parte del id, sin distinguir mayusculas', async () => {
    const cards = await cohort()
    const id = cards[0]?.pitcherId ?? ''
    const found = applyFilters(cards, { ...NO_FILTERS, query: id.slice(-5).toUpperCase() })
    expect(found.some((c) => c.pitcherId === id)).toBe(true)
    expect(isFiltered({ ...NO_FILTERS, query: '  ' })).toBe(false)
  })

  it('solo ofrece filtros que devuelven algo, y cuenta bien cada pitch', async () => {
    const cards = await cohort()
    for (const season of availableSeasons(cards)) {
      expect(applyFilters(cards, { ...NO_FILTERS, season }).length).toBeGreaterThan(0)
    }
    for (const { pitch, count } of availablePitches(cards)) {
      expect(applyFilters(cards, { ...NO_FILTERS, pitch })).toHaveLength(count)
    }
  })
})

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason, toSeasonEntry } from '@/sources/adapter'
import { selectRadarCohort } from './cohort'
import { dominantPitch, dominantPitchTypes } from './arsenal'
import { applyFilters, availableSeasons, availableThrows, isFiltered, NO_FILTERS } from './filters'

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
    const season = availableSeasons(cards)[0]
    const hand = availableThrows(cards)[0]
    const pitch = dominantPitchTypes(cards)[0]

    expect(
      applyFilters(cards, { ...NO_FILTERS, season: season ?? null }).every(
        (c) => c.season === season,
      ),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, throws: hand ?? null }).every((c) => c.throws === hand),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, role: 'starter' }).every((c) => c.role === 'starter'),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, pitch: pitch ?? null }).every(
        (c) => dominantPitch(c)?.pitch === pitch,
      ),
    ).toBe(true)
    expect(
      applyFilters(cards, { ...NO_FILTERS, trapsOnly: true }).every((c) => c.altitudeTrap),
    ).toBe(true)
  })

  it('solo ofrece filtros que devuelven algo', async () => {
    const cards = await cohort()
    for (const season of availableSeasons(cards)) {
      expect(applyFilters(cards, { ...NO_FILTERS, season }).length).toBeGreaterThan(0)
    }
    for (const pitch of dominantPitchTypes(cards)) {
      expect(applyFilters(cards, { ...NO_FILTERS, pitch }).length).toBeGreaterThan(0)
    }
  })

  it('los filtros se componen y nunca amplian el resultado', async () => {
    const cards = await cohort()
    const one = applyFilters(cards, { ...NO_FILTERS, role: 'reliever' })
    const two = applyFilters(cards, { ...NO_FILTERS, role: 'reliever', trapsOnly: true })
    expect(two.length).toBeLessThanOrEqual(one.length)
    expect(two.every((c) => c.role === 'reliever' && c.altitudeTrap)).toBe(true)
  })
})

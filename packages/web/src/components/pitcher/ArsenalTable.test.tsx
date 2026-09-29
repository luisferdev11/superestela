import { readFile } from 'node:fs/promises'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArsenalTable } from './ArsenalTable'
import { PitcherPhysics } from './PitcherPhysics'
import type { DensityScale } from '@/domain/density'
import { evidencePath, mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason } from '@/sources/adapter'
import { es } from '@/i18n/es'

const card = async () => {
  const parsed = mockupDataSchema.parse(JSON.parse(await readFile(mockupDataPath(), 'utf8')))
  const found = parsed.pitchers.find((p) => p.pitcher_id === 'pitcher_00069' && p.season === 2025)
  if (found === undefined) throw new Error('pitcher_00069 2025 no esta en el artefacto')
  return toPitcherSeason(found)
}

describe('la tabla del arsenal de pitcher_00069', () => {
  it('cada Stuff+ sale con su banda, en los dos entornos', async () => {
    render(<ArsenalTable card={await card()} />)
    const fastball = screen.getByText('Four-Seam').closest('tr')
    if (fastball === null) throw new Error('sin fila de la recta')
    expect(within(fastball).getByLabelText('111.0 ± 1.0')).toBeInTheDocument()
    expect(within(fastball).getByLabelText('90.4 ± 0.5')).toBeInTheDocument()
  })

  it('una fila por pitch, en orden de uso', async () => {
    render(<ArsenalTable card={await card()} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Four-Seam',
      'Slider',
      'Curveball',
    ])
  })
})

describe('la frase de fisica', () => {
  it('la densidad y el factor Magnus salen de evidence.json, no del componente', async () => {
    const evidence = JSON.parse(await readFile(evidencePath(), 'utf8')) as {
      density: Record<string, { density_ratio: number; magnus_ratio: number }>
    }
    const extreme = evidence.density['Extreme Altitude']
    if (extreme === undefined) throw new Error('evidence.json sin altitud extrema')
    const level = {
      label: 'Extreme Altitude',
      densityRatio: extreme.density_ratio,
      magnusRatio: extreme.magnus_ratio,
      nPitches: 1,
    }
    const scale: DensityScale = { levels: [level], sea: level, extreme: level }
    render(<PitcherPhysics scale={scale} />)
    expect(
      screen.getByText(
        es.ficha.physics.body(extreme.density_ratio.toFixed(3), extreme.magnus_ratio.toFixed(3)),
      ),
    ).toBeInTheDocument()
  })
})

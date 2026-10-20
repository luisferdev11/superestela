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
    render(<ArsenalTable card={await card()} simulatorHrefs={{}} />)
    const fastball = screen.getByText('Four-Seam').closest('tr')
    if (fastball === null) throw new Error('sin fila de la recta')
    expect(within(fastball).getByLabelText('115.2 ± 0.9')).toBeInTheDocument()
    expect(within(fastball).getByLabelText('98.6 ± 1.0')).toBeInTheDocument()
  })

  it('una fila por pitch, en orden de uso', async () => {
    render(<ArsenalTable card={await card()} simulatorHrefs={{}} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Four-Seam',
      'Slider',
      'Curveball',
    ])
  })
})

describe('abrir en el Simulador', () => {
  it('solo los pitches con enlace lo ofrecen, con una etiqueta que dice cual', async () => {
    render(
      <ArsenalTable
        card={await card()}
        simulatorHrefs={{ 'Four-Seam': '/simulador?pitcher=pitcher_00069%2F2025&pitch=Four-Seam' }}
      />,
    )
    const link = screen.getByRole('link', { name: es.ficha.arsenal.simulateLabel('Four-Seam') })
    expect(link.getAttribute('href')).toContain('pitch=Four-Seam')
    expect(screen.getAllByRole('link')).toHaveLength(1)
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

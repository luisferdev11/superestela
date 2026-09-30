import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectionTable } from './ProjectionTable'
import { bandAgreement } from '@/domain/projection'
import { loadProjections } from '@/sources/projectionSource'
import { es } from '@/i18n/es'

vi.mock('server-only', () => ({}))

const setup = async () => {
  const projections = await loadProjections()
  const projection = projections.pitchers.get('pitcher_00069/2025')
  if (projection === undefined) throw new Error('sin proyeccion de pitcher_00069 2025')
  render(
    <ProjectionTable
      projection={projection}
      densities={{ hh: projections.densities.hh, medium: projections.densities.medium }}
      factors={projections.factors}
    />,
  )
  return { projection, projections }
}

describe('la tabla de proyeccion', () => {
  it('en el Harp Helu compara con lo medido y dice cuantos caen en la banda', async () => {
    const { projection } = await setup()
    const { inBand, checked } = bandAgreement(projection)
    expect(
      screen.getByText(new RegExp(es.projection.agreement(inBand, checked))),
    ).toBeInTheDocument()
    expect(screen.getAllByText(es.projection.inBand).length).toBeGreaterThan(0)
  })

  it('en altitud media declara la extrapolacion y no compara con nada', async () => {
    const { projections } = await setup()
    fireEvent.click(
      screen.getByRole('button', {
        name: es.projection.targets.medium(projections.densities.medium.toFixed(3)),
      }),
    )
    expect(screen.getByText(es.projection.extrapolation)).toBeInTheDocument()
    expect(screen.queryByText(es.projection.inBand)).toBeNull()
  })
})

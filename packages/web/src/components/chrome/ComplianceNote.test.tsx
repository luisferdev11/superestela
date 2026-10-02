import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComplianceNote } from './ComplianceNote'
import { NavRail } from './NavRail'
import type { DensityScale } from '@/domain/density'
import { es } from '@/i18n/es'

const LEVEL = { label: 'sea', densityRatio: 1, magnusRatio: 1, nPitches: 1 }
const SCALE: DensityScale = { levels: [LEVEL], sea: LEVEL, extreme: LEVEL }

describe('ComplianceNote', () => {
  it('declara la prohibicion de apuestas con su propio titulo', () => {
    render(<ComplianceNote />)
    expect(screen.getByRole('region', { name: es.compliance.title })).toBeInTheDocument()
    for (const rule of es.compliance.rules) expect(screen.getByText(rule)).toBeInTheDocument()
  })

  it('va en el rail, asi que la ve cada pantalla que lo usa', () => {
    render(<NavRail scale={SCALE} nPitches={1} seasons={[2025]} current="/radar" />)
    expect(screen.getByRole('region', { name: es.compliance.title })).toBeInTheDocument()
  })
})

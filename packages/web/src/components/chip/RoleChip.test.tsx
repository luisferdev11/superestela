import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoleChip } from './RoleChip'
import { TrapFlag } from './TrapFlag'
import { es } from '@/i18n/es'

describe('RoleChip', () => {
  it('traduce los dos roles al renderizar, no en el componente', () => {
    render(<RoleChip role="starter" />)
    expect(screen.getByText(es.role.starter)).toBeInTheDocument()
  })

  it('un rol nulo no inventa una categoria', () => {
    render(<RoleChip role="reliever" />)
    expect(screen.getByText(es.role.reliever)).toBeInTheDocument()
  })
})

describe('TrapFlag', () => {
  it('la bandera no depende solo del color: lleva texto para lectores', () => {
    render(<TrapFlag trap />)
    expect(screen.getByText(es.trap)).toBeInTheDocument()
  })

  it('sin trampa no dibuja nada', () => {
    const { container } = render(<TrapFlag trap={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})

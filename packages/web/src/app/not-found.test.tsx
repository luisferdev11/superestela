import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NotFound from './not-found'
import { es } from '@/i18n/es'

vi.mock('server-only', () => ({}))

describe('the 404', () => {
  it('speaks Spanish, keeps the rail and leads back to the Radar', async () => {
    render(await NotFound())
    expect(screen.getByRole('heading', { name: es.notFound.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.notFound.back })).toHaveAttribute('href', '/radar')
    expect(screen.getByRole('link', { name: es.nav.items.radar })).toBeInTheDocument()
  })
})

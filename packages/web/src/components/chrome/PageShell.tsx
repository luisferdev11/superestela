import type { ReactNode } from 'react'
import { NavRail } from './NavRail'
import type { DensityScale } from '@/domain/density'

/** El rail y el area de contenido que comparten las pantallas de un lanzador. */
export const PageShell = ({
  density,
  nPitches,
  seasons,
  current,
  children,
}: {
  readonly density: DensityScale
  readonly nPitches: number
  readonly seasons: readonly number[]
  readonly current: string
  readonly children: ReactNode
}) => (
  <div className="flex min-h-screen bg-(--color-surface-page)">
    <NavRail scale={density} nPitches={nPitches} seasons={seasons} current={current} />
    <main className="flex min-w-0 grow flex-col gap-5 px-8 py-7">{children}</main>
  </div>
)

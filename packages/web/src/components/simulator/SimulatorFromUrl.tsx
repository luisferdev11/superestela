'use client'

import type { ComponentProps } from 'react'
import { useSearchParams } from 'next/navigation'
import { Simulator } from './Simulator'
import { parseSimulatorStart } from '@/domain/simulator'

/**
 * El Simulador que parte de la URL (`?pitcher=<id>/<temporada>&pitch=<tipo>`),
 * que es como llega la Ficha. `useSearchParams` obliga a renderizar en el
 * cliente hasta el `Suspense` mas cercano; la pagina lo envuelve con el
 * Simulador por defecto como `fallback`, asi que el HTML prerenderizado sigue
 * mostrando el Simulador completo. La `key` reinicia su estado si la URL cambia.
 */
export const SimulatorFromUrl = (props: Omit<ComponentProps<typeof Simulator>, 'start'>) => {
  const start = parseSimulatorStart(useSearchParams(), props.arsenals)
  return (
    <Simulator
      key={start === null ? 'default' : `${start.pitcherKey}:${start.pitchType}`}
      {...props}
      start={start}
    />
  )
}

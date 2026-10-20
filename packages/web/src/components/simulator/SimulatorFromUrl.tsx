'use client'

import { useState, type ComponentProps } from 'react'
import { useSearchParams } from 'next/navigation'
import { Simulator } from './Simulator'
import { parseSimulatorStart, type SimulatorStart } from '@/domain/simulator'

const keyOf = (start: SimulatorStart | null): string =>
  start === null ? 'default' : `${start.pitcherKey}:${start.pitchType}`

/**
 * El Simulador que parte de la URL (`?pitcher=<id>/<temporada>&pitch=<tipo>`),
 * que es como llega la Ficha. `useSearchParams` obliga a renderizar en el
 * cliente hasta el `Suspense` mas cercano; la pagina lo envuelve con el
 * Simulador por defecto como `fallback`, asi que el HTML prerenderizado sigue
 * mostrando el Simulador completo. La `key` reinicia su estado si la URL cambia.
 */
export const SimulatorFromUrl = (
  props: Omit<ComponentProps<typeof Simulator>, 'start' | 'onPitcherChange'>,
) => {
  const start = parseSimulatorStart(useSearchParams(), props.arsenals)
  const urlKey = keyOf(start)
  // What the Simulator itself last wrote to the URL, and the key it had then:
  // its own change must not remount it, a link from elsewhere must.
  const [written, setWritten] = useState<{ readonly url: string; readonly key: string } | null>(
    null,
  )
  const key = written !== null && written.url === urlKey ? written.key : urlKey
  return (
    <Simulator
      key={key}
      {...props}
      start={start}
      onPitcherChange={(next, href) => {
        setWritten({ url: keyOf(next), key })
        window.history.replaceState(null, '', href)
      }}
    />
  )
}

'use client'

import { useState } from 'react'
import { LocationMap, sharesOf } from './LocationMap'
import { sharedMax, type LocationPanel, type PitchMaps } from '@/domain/location'
import { es } from '@/i18n/es'

const chip = (active: boolean): string =>
  `h-8 cursor-pointer border px-3 text-[12px] font-semibold ${
    active
      ? 'border-(--color-ink) bg-(--color-ink) text-(--color-surface-card)'
      : 'border-(--color-border-strong) bg-(--color-surface-card) text-(--color-text)'
  }`

/**
 * Los dos mapas de ubicacion de la pestana Arsenal, con un filtro por tipo de
 * pitch (lo pidio el equipo, 20 oct): «Todos» son los paneles de siempre; un
 * tipo dibuja solo ese pitch en cada entorno, con su Location+.
 */
export const LocationExplorer = ({
  sea,
  hh,
  pitches,
  order,
}: {
  readonly sea: LocationPanel | null
  readonly hh: LocationPanel | null
  readonly pitches: Readonly<Record<string, PitchMaps>>
  /** Los tipos en el orden de su arsenal, del mas usado al menos. */
  readonly order: readonly string[]
}) => {
  const [pitch, setPitch] = useState<string | null>(null)
  const types = [
    ...order.filter((t) => t in pitches),
    ...Object.keys(pitches).filter((t) => !order.includes(t)),
  ]
  const focus = pitch === null ? undefined : pitches[pitch]
  const max =
    focus === undefined
      ? sharedMax([sea, hh])
      : Math.max(1e-9, ...[focus.sea, focus.hh].flatMap((m) => (sharesOf(m) ?? []).flat()))

  return (
    <section className="flex flex-col gap-4 border border-(--color-border) bg-(--color-surface-card) p-5">
      {types.length === 0 ? null : (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={es.ficha.location.filter}
        >
          <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
            {es.ficha.location.filter}
          </span>
          <button
            type="button"
            aria-pressed={pitch === null}
            className={chip(pitch === null)}
            onClick={() => {
              setPitch(null)
            }}
          >
            {es.ficha.location.allPitches}
          </button>
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={pitch === t}
              className={chip(pitch === t)}
              onClick={() => {
                setPitch(t)
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-6">
        <LocationMap
          title={es.ficha.location.panel.sea}
          panel={sea}
          max={max}
          focus={pitch === null || focus === undefined ? undefined : { pitch, map: focus.sea }}
        />
        <LocationMap
          title={es.ficha.location.panel.hh}
          panel={hh}
          max={max}
          focus={pitch === null || focus === undefined ? undefined : { pitch, map: focus.hh }}
        />
      </div>
    </section>
  )
}

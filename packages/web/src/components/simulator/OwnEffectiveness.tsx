'use client'

import { apiFetch } from '@/sources/apiClient'
import { useEffect, useState } from 'react'
import { ZoneGrid, sharesOf } from '@/components/pitcher/LocationMap'
import type { CountMap, PitchEffectiveness } from '@/domain/location'
import type { PitchType } from '@/domain/simulator'
import { es } from '@/i18n/es'

type State = {
  readonly key: string
  readonly maps: Readonly<Record<string, PitchEffectiveness>> | null
} | null

const Panel = ({
  title,
  map,
  max,
  tone,
  pitchType,
}: {
  readonly title: string
  readonly map: CountMap
  readonly max: number
  readonly tone: string
  readonly pitchType: string
}) => (
  <figure className="m-0 flex flex-1 flex-col gap-2">
    <figcaption className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="font-bold">{title}</span>
      <span className="text-(--color-text-muted)">{es.sim.own.count(map.nPitches)}</span>
    </figcaption>
    <ZoneGrid
      grid={sharesOf(map)}
      max={max}
      tone={tone}
      label={es.sim.own.label(title, pitchType, map.nPitches)}
    />
  </figure>
)

/**
 * Donde pone el lanzador elegido sus pitches mas y menos efectivos de un tipo:
 * lo que el mapa de la liga no dice de el (lo pidio el equipo, 20 oct). Es
 * conteo de sus propios lanzamientos, no modelo.
 */
export const OwnEffectiveness = ({
  pitcherKey,
  pitchType,
}: {
  readonly pitcherKey: string
  readonly pitchType: PitchType
}) => {
  const [state, setState] = useState<State>(null)
  useEffect(() => {
    let live = true
    apiFetch(`/api/pitch-effectiveness?${new URLSearchParams({ key: pitcherKey }).toString()}`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, PitchEffectiveness>>) : null))
      .catch(() => null)
      .then((maps) => {
        if (live) setState({ key: pitcherKey, maps })
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [pitcherKey])

  const maps = state?.key === pitcherKey ? state.maps : null
  const pitch = maps?.[pitchType] ?? null
  const max =
    pitch === null
      ? 1
      : Math.max(1e-9, ...[pitch.most, pitch.least].flatMap((m) => (sharesOf(m) ?? []).flat()))

  return (
    <div className="flex flex-col gap-3">
      <div className="border-b-2 border-(--color-ink) pb-2">
        <div className="text-[13px] font-semibold">{es.sim.own.title(pitchType)}</div>
        <div className="text-[11px] text-(--color-text-muted)">{es.sim.own.subtitle}</div>
      </div>
      {state === null || state.key !== pitcherKey ? (
        <p className="text-[12px] text-(--color-text-muted)">{es.sim.status.loading}</p>
      ) : pitch === null ? (
        <p className="text-[12px] text-(--color-text-muted)">{es.sim.own.none(pitchType)}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Panel
            title={es.sim.own.most}
            map={pitch.most}
            max={max}
            tone="var(--color-altitude-sea)"
            pitchType={pitchType}
          />
          <Panel
            title={es.sim.own.least}
            map={pitch.least}
            max={max}
            tone="var(--color-altitude-extreme)"
            pitchType={pitchType}
          />
        </div>
      )}
    </div>
  )
}

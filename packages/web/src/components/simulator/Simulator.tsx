'use client'

import { useMemo, useState } from 'react'
import { PitchSlider } from './PitchSlider'
import { StuffPlusKpis } from './StuffPlusKpis'
import { AltitudePhysics } from './AltitudePhysics'
import { MovementMapPair } from './MovementMapPair'
import { ArsenalContext } from './ArsenalContext'
import { Comparables } from './Comparables'
import { OwnEffectiveness } from './OwnEffectiveness'
import { IS_STATIC } from '@/sources/apiClient'
import { useSimulation } from './useSimulation'
import {
  CONTROL_GROUPS,
  DEFAULT_PITCHER,
  HANDS,
  PITCH_TYPES,
  REFERENCE_CONTROLS,
  baselinePitches,
  buildRequest,
  changedControls,
  labArsenal,
  leagueMedian,
  simulatorHref,
  sliderSpec,
  type Control,
  type Distributions,
  type Hand,
  type PitchType,
  type PitchValues,
  type PitcherArsenal,
  type ReferenceControl,
  type SimMode,
  type SimulatorStart,
} from '@/domain/simulator'
import type { DensityScale } from '@/domain/density'
import type { MovementMaps } from '@/domain/movementMap'
import type { Validation } from '@/sources/simulatorSource'
import { formatNumber } from '@/domain/format'
import { es } from '@/i18n/es'

type Selection = {
  readonly mode: SimMode
  readonly pitcherKey: string
  readonly pitchType: PitchType
  readonly labHand: Hand
}

const chip = (active: boolean): string =>
  active
    ? 'cursor-pointer border-0 bg-(--color-ink) px-3 py-1.5 text-xs font-semibold text-white'
    : 'cursor-pointer border-0 bg-(--color-surface-card) px-3 py-1.5 text-xs text-(--color-text)'

/**
 * Que modelo contesto y cuantas compuertas paso. El modelo es el de la
 * respuesta de la API, que es quien de verdad puntuo; el conteo sale del
 * registro publicado solo si ese registro juzgo al mismo modelo. Si no, se dice
 * que sus compuertas no estan publicadas, en vez de prestarle las de otro.
 */
const provenance = (answeredBy: string | null, validation: Validation | null): string | null => {
  if (validation !== null && (answeredBy === null || answeredBy === validation.modelId)) {
    return es.sim.provenance(
      validation.modelId,
      validation.passed,
      validation.total,
      validation.usesArsenal,
    )
  }
  return answeredBy === null ? null : es.sim.provenanceUnpublished(answeredBy)
}

/**
 * La isla interactiva de la P4. Aqui no se calcula ningun score: la pantalla
 * arma la peticion, la API contesta y esto dibuja (`CONVENTIONS.md` seccion 4,
 * regla 6). Lo unico que decide es de donde se parte: el pitch real del
 * lanzador o la mediana de la liga.
 */
export const Simulator = ({
  distributions,
  maps,
  arsenals,
  scale,
  validation,
  start = null,
  onPitcherChange,
}: {
  readonly distributions: Distributions
  readonly maps: MovementMaps
  readonly arsenals: readonly PitcherArsenal[]
  readonly scale: DensityScale
  readonly validation: Validation | null
  /** De donde parte si se llega desde la Ficha; `null` es el lanzador por defecto. */
  readonly start?: SimulatorStart | null
  /**
   * Called with the address of the pitcher and pitch now shown, so the URL
   * follows the selection and can be shared or reloaded.
   */
  readonly onPitcherChange?: (start: SimulatorStart, href: string) => void
}) => {
  const byKey = useMemo(() => new Map(arsenals.map((a) => [a.key, a])), [arsenals])
  const first = arsenals.find((a) => a.pitcherId === DEFAULT_PITCHER) ?? arsenals[0] ?? null

  const baselineOf = (sel: Selection): PitchValues => {
    const arsenal = byKey.get(sel.pitcherKey)
    const real = baselinePitches(arsenal?.sea ?? []).find((p) => p.pitchType === sel.pitchType)
    return sel.mode === 'pitcher' && real !== undefined
      ? real
      : leagueMedian(distributions, sel.pitchType)
  }

  const initial: Selection =
    start === null
      ? {
          mode: first === null ? 'lab' : 'pitcher',
          pitcherKey: first?.key ?? '',
          pitchType: baselinePitches(first?.sea ?? [])[0]?.pitchType ?? 'Four-Seam',
          labHand: 'Right',
        }
      : {
          mode: 'pitcher',
          pitcherKey: start.pitcherKey,
          pitchType: start.pitchType,
          labHand: 'Right',
        }
  const [selection, setSelection] = useState<Selection>(initial)
  const [values, setValues] = useState<PitchValues>(() => baselineOf(initial))
  // Los lanzadores con el pitch mas y menos efectivo de la liga: a eleccion, apagados
  // de entrada; lo especifico del lanzador va en su propia seccion (20 oct).
  const [showExtremes, setShowExtremes] = useState(false)
  const leagueFastball = (): Record<ReferenceControl, number> => {
    const median = leagueMedian(distributions, 'Four-Seam')
    return {
      releaseSpeed: median.releaseSpeed,
      ivb: median.ivb,
      horizontalBreak: median.horizontalBreak,
    }
  }
  const [reference, setReference] = useState(leagueFastball)

  const select = (next: Partial<Selection>): void => {
    const merged = { ...selection, ...next }
    const arsenal = byKey.get(merged.pitcherKey)
    // Un lanzador sin el pitch elegido arranca por el que mas usa.
    const pitchType =
      merged.mode === 'pitcher' &&
      arsenal &&
      !baselinePitches(arsenal.sea).some((p) => p.pitchType === merged.pitchType)
        ? (baselinePitches(arsenal.sea)[0]?.pitchType ?? merged.pitchType)
        : merged.pitchType
    const resolved = { ...merged, pitchType }
    setSelection(resolved)
    setValues(baselineOf(resolved))
    if (resolved.mode === 'pitcher' && arsenal !== undefined) {
      onPitcherChange?.(
        { pitcherKey: resolved.pitcherKey, pitchType },
        simulatorHref(arsenal.pitcherId, arsenal.season, pitchType),
      )
    }
  }

  const arsenal = byKey.get(selection.pitcherKey)
  const inPitcherMode = selection.mode === 'pitcher' && arsenal !== undefined
  const hand = inPitcherMode ? arsenal.hand : selection.labHand
  const pitches = inPitcherMode ? baselinePitches(arsenal.sea).map((p) => p.pitchType) : PITCH_TYPES
  const baseline = baselineOf(selection)
  const context = inPitcherMode ? arsenal.sea : labArsenal(distributions, reference)
  const pitcherId = inPitcherMode ? arsenal.pitcherId : null

  const simulation = useSimulation(
    buildRequest(values, selection.pitchType, hand, context, pitcherId),
  )
  const real = useSimulation(buildRequest(baseline, selection.pitchType, hand, context, pitcherId))
  const result = simulation.status === 'ready' ? simulation.result : simulation.last
  const realResult = real.status === 'ready' ? real.result : null

  const onChange = (control: Control, value: number): void => {
    setValues((v) => ({ ...v, [control]: value }))
  }

  return (
    <div className="flex flex-col gap-4">
      {IS_STATIC ? (
        <p className="border-l-4 border-(--color-diablos) bg-(--color-surface-card) px-4 py-2 text-[12px]">
          {es.sim.staticNote}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border border-(--color-ink)" role="group">
          {(['pitcher', 'lab'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={chip(selection.mode === m)}
              aria-pressed={selection.mode === m}
              onClick={() => select({ mode: m })}
            >
              {es.sim.modes[m]}
            </button>
          ))}
        </div>
        {selection.mode === 'pitcher' ? (
          <label className="flex items-center gap-2 text-xs text-(--color-text-muted)">
            {es.sim.pitcher}
            <select
              value={selection.pitcherKey}
              onChange={(e) => {
                select({ pitcherKey: e.target.value })
              }}
              className="border border-(--color-border) bg-(--color-surface-card) px-2 py-1.5 text-xs text-(--color-text)"
            >
              {arsenals.map((a) => (
                <option key={a.key} value={a.key}>
                  {es.sim.pitcherOption(a.pitcherId, a.season)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div
            className="flex border border-(--color-border)"
            role="group"
            aria-label={es.sim.hand}
          >
            {HANDS.map((h) => (
              <button
                key={h}
                type="button"
                className={chip(selection.labHand === h)}
                aria-pressed={selection.labHand === h}
                onClick={() => select({ labHand: h })}
              >
                {es.sim.hands[h]}
              </button>
            ))}
          </div>
        )}
        <div className="flex border border-(--color-border)" role="group" aria-label={es.sim.pitch}>
          {pitches.map((pt) => (
            <button
              key={pt}
              type="button"
              className={chip(selection.pitchType === pt)}
              aria-pressed={selection.pitchType === pt}
              onClick={() => select({ pitchType: pt })}
            >
              {pt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex w-[340px] shrink-0 flex-col gap-4 border border-(--color-border) bg-(--color-surface-card) p-5">
          {CONTROL_GROUPS.map((group) => (
            <fieldset key={group.id} className="flex flex-col gap-3 border-0 p-0">
              <legend className="w-full border-b border-(--color-border-hairline) pb-1.5 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
                {es.sim.groups[group.id]}
              </legend>
              {group.controls.map((c) => (
                <PitchSlider
                  key={c}
                  control={c}
                  value={values[c]}
                  spec={sliderSpec(distributions[selection.pitchType][c], c)}
                  baseline={baseline[c]}
                  muted={group.id === 'spin'}
                  onChange={onChange}
                />
              ))}
              {group.id === 'spin' && result !== null ? (
                <div className="flex flex-col gap-1.5 text-[11px] leading-relaxed">
                  <span className="tabular-nums">
                    {es.sim.spin.perKrpm(
                      formatNumber(result.movementPerKrpm.value, 1),
                      formatNumber(result.movementPerKrpm.percentile, 0),
                    )}
                  </span>
                  {result.plausibility.isPlausible ? null : (
                    <span role="alert" className="font-semibold text-(--color-semantic-trap)">
                      {es.sim.spin.implausible}
                    </span>
                  )}
                  <span className="text-(--color-text-muted)">{es.sim.spin.note}</span>
                </div>
              ) : null}
            </fieldset>
          ))}
          {inPitcherMode || selection.pitchType === 'Four-Seam' ? null : (
            <fieldset className="flex flex-col gap-2 border-0 p-0">
              <legend className="w-full border-b border-(--color-border-hairline) pb-1.5 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
                {es.sim.reference.title}
              </legend>
              <p className="text-[11px] leading-snug text-(--color-text-muted)">
                {es.sim.reference.note}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {REFERENCE_CONTROLS.map((c) => (
                  <label key={c} className="flex flex-col gap-1 text-[11px]">
                    {`${es.sim.controls[c]} (${es.sim.units[c]})`}
                    <input
                      type="number"
                      step={0.5}
                      value={reference[c]}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v)) setReference((r) => ({ ...r, [c]: v }))
                      }}
                      className="h-8 w-full border border-(--color-border-strong) bg-(--color-surface-card) px-2 text-[13px] tabular-nums"
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setReference(leagueFastball())
                }}
                className="cursor-pointer self-start border-0 bg-transparent p-0 text-[11px] underline"
              >
                {es.sim.reference.reset}
              </button>
            </fieldset>
          )}
          <p className="text-[11px] text-(--color-text-muted)">{es.sim.armSideNote}</p>
          <button
            type="button"
            onClick={() => {
              setValues(baseline)
            }}
            className="cursor-pointer border border-(--color-border) bg-(--color-surface-card) p-2 text-xs"
          >
            {inPitcherMode ? es.sim.resetPitcher : es.sim.resetLab}
          </button>
        </div>

        <div
          className="flex min-w-0 grow flex-col gap-4"
          aria-live="polite"
          aria-busy={simulation.status === 'loading'}
        >
          {result === null ? (
            <div className="border border-(--color-border) bg-(--color-surface-card) p-5 text-sm text-(--color-text-muted)">
              {simulation.status === 'error'
                ? es.sim.status[simulation.kind]
                : es.sim.status.loading}
            </div>
          ) : (
            <>
              {simulation.status === 'error' ? (
                <div role="alert" className="text-xs text-(--color-semantic-trap)">
                  {es.sim.status[simulation.kind]}
                </div>
              ) : null}
              <StuffPlusKpis
                result={result}
                baseline={
                  inPitcherMode && changedControls(values, baseline).length > 0 ? realResult : null
                }
              />
              {/* Mapa y fisica lado a lado: a 1440x900 los dos caben sin scroll (14 oct). */}
              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <div className="border border-(--color-border) bg-(--color-surface-card) p-4">
                  <MovementMapPair
                    pitchType={selection.pitchType}
                    panels={maps[selection.pitchType]}
                    result={result}
                    showExtremes={showExtremes}
                    onShowExtremesChange={setShowExtremes}
                  />
                </div>
                <div className="border border-(--color-border) bg-(--color-surface-card) p-4">
                  <AltitudePhysics result={result} scale={scale} spinRate={values.spinRate} />
                </div>
              </div>
              {inPitcherMode ? (
                <div className="border border-(--color-border) bg-(--color-surface-card) p-4">
                  <OwnEffectiveness
                    pitcherKey={selection.pitcherKey}
                    pitchType={selection.pitchType}
                  />
                </div>
              ) : null}
              {inPitcherMode ? (
                <div className="border border-(--color-border) bg-(--color-surface-card) p-5">
                  <ArsenalContext result={result} pitchType={selection.pitchType} />
                </div>
              ) : null}
              {!inPitcherMode && result.sea.comparables.length > 0 ? (
                <details className="border border-(--color-border) bg-(--color-surface-card) px-5 py-3">
                  <summary className="cursor-pointer text-[12px] font-semibold">
                    {es.sim.comparables.toggle}
                  </summary>
                  <div className="mt-3">
                    <Comparables result={result} />
                  </div>
                </details>
              ) : null}
            </>
          )}
          <p className="text-[11px] text-(--color-text-muted)">
            {provenance(result?.modelId ?? null, validation)} {es.sim.noRuns}
          </p>
        </div>
      </div>
    </div>
  )
}

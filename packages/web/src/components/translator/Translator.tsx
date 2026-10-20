'use client'

import { useState } from 'react'
import { ArsenalEditor } from './ArsenalEditor'
import { ChipGroup } from './ChipGroup'
import { FileUpload } from './FileUpload'
import { TranslationTable } from './TranslationTable'
import { useTranslation } from './useTranslation'
import { ValidationExample } from './ValidationExample'
import { ArsenalMap } from '@/components/pitcher/ArsenalMap'
import { HANDS, type Hand, type PitcherArsenal } from '@/domain/simulator'
import {
  ORIGINS,
  exampleRows,
  fileRows,
  isExtrapolation,
  isReady,
  normalizedUsage,
  translatorRequests,
  validationRows,
  weightedMetric,
  type Origin,
  type TranslatorRow,
} from '@/domain/translator'
import type { MapPitch } from '@/domain/arsenalMap'
import type { Metric } from '@/domain/types'
import { formatMetric, formatNumber, formatSignedMetric } from '@/domain/format'
import type { ArsenalSummary } from '@/sources/arsenalSummary'
import { es } from '@/i18n/es'

export type Densities = { readonly sea: number; readonly medium: number; readonly hh: number }
/** El factor de Magnus de nivel del mar a cada destino, de `projections.json`. */
export type Factors = { readonly medium: number; readonly hh: number }

/** Los usos capturados como porcentaje: un ejemplo real llega en fracciones. */
const asPercent = (rows: readonly TranslatorRow[]): TranslatorRow[] =>
  rows.map((r) => ({ ...r, usage: Math.round(1000 * r.usage) / 10 }))

const Kpi = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <div className="flex flex-col gap-1 border border-(--color-border) bg-(--color-surface-card) px-5 py-3.5">
    <div className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
      {label}
    </div>
    <div className="text-[22px] font-bold tabular-nums">{value}</div>
  </div>
)

const show = (metric: Metric | null, signed = false): string =>
  metric === null
    ? es.translator.kpi.none
    : signed
      ? formatSignedMetric(metric)
      : formatMetric(metric)

/**
 * La isla de la P3 (`Traductor.dc.html`). Aqui no se calcula ningun score: la
 * pantalla arma una pregunta por pitch, la API contesta cada una igual que en
 * el Simulador, y esto pondera y dibuja.
 *
 * Es para el lanzador que no esta en nuestros datos (entregable 3c): la entrada
 * principal es su export de TrackMan. El unico arsenal real es un ejemplo de
 * validacion, que se compara contra lo que se midio en altitud extrema.
 */
export const Translator = ({
  example,
  densities,
  factors,
}: {
  /** Un lanzador que si lanzo en altitud extrema: el ejemplo con el que se valida. */
  readonly example: PitcherArsenal | null
  readonly densities: Densities
  readonly factors: Factors
}) => {
  const first = example

  const [source, setSource] = useState<PitcherArsenal | null>(first)
  const [edited, setEdited] = useState(false)
  const [rows, setRows] = useState<TranslatorRow[]>(() =>
    first === null ? [] : asPercent(exampleRows(first)),
  )
  const [origin, setOrigin] = useState<Origin>('sea')
  const [hand, setHand] = useState<Hand>(first?.hand ?? 'Right')
  // Cambia solo al cargar un ejemplo: las celdas se reinician sin perder el foco al teclear.
  const [loads, setLoads] = useState(0)

  const load = (arsenal: PitcherArsenal): void => {
    setSource(arsenal)
    setEdited(false)
    setRows(asPercent(exampleRows(arsenal)))
    setHand(arsenal.hand)
    setOrigin('sea')
    setLoads((n) => n + 1)
  }
  const loadFile = (summary: ArsenalSummary): void => {
    setSource(null)
    setEdited(true)
    setRows(fileRows(summary.pitches))
    setHand(summary.pitcherHand)
    setOrigin(summary.origin ?? 'sea')
    setLoads((n) => n + 1)
  }
  const clear = (): void => {
    setSource(null)
    setEdited(true)
    setRows([])
    setOrigin('sea')
    setLoads((n) => n + 1)
  }
  const edit = (next: TranslatorRow[], remount = false): void => {
    setRows(next)
    setEdited(true)
    if (remount) setLoads((n) => n + 1)
  }

  const ready = isReady(rows)
  const requests = ready ? translatorRequests(rows, hand, densities[origin]) : []
  const translation = useTranslation(requests)
  // Mientras llega la respuesta nueva se conserva la anterior, atenuada, pero
  // solo si preguntaba por los mismos pitches en el mismo orden. Tras un error
  // no se dibuja nada viejo: el estado lo dice.
  const samePitches = (asked: readonly { readonly pitch: { readonly pitchType: string } }[]) =>
    asked.length === rows.length && asked.every((q, i) => q.pitch.pitchType === rows[i]?.pitchType)
  const current =
    translation.status === 'ready'
      ? translation.results
      : translation.status === 'loading' &&
          translation.last !== null &&
          samePitches(translation.last.requests)
        ? translation.last.results
        : null
  const isStale = translation.status === 'loading' && current !== null
  // El ejemplo valida solo mientras es su arsenal del mar, sin tocar.
  const isExample = !edited && source !== null
  const validation =
    isExample && current !== null
      ? validationRows(
          rows,
          current.map((r) => r.harpHelu.shape),
          source.hh,
        )
      : null

  const shares = normalizedUsage(rows)
  const shown = current?.every((r) => r.stuffPlusShown) ?? false
  const sea = shown ? weightedMetric(current?.map((r) => r.sea.stuffPlus) ?? [], shares) : null
  const hh = shown ? weightedMetric(current?.map((r) => r.harpHelu.stuffPlus) ?? [], shares) : null
  const delta = shown
    ? weightedMetric(current?.map((r) => r.altitudeDelta?.total ?? null) ?? [], shares)
    : null
  const reason = current?.find((r) => r.stuffPlusReason !== null)?.stuffPlusReason ?? null

  // Desde donde se midio hasta altitud extrema: el factor de nivel del mar entre el del origen.
  const factor = origin === 'sea' ? factors.hh : factors.hh / factors.medium
  const mapPitches: readonly MapPitch[] =
    current === null
      ? []
      : rows.map((r, i) => ({
          pitchType: r.pitchType,
          usage: shares[i] ?? null,
          sea: {
            ivb: current[i]?.sea.shape.ivb.value ?? r.ivb,
            hb: current[i]?.sea.shape.horizontalBreak.value ?? r.horizontalBreak,
          },
          hh:
            current[i] === undefined
              ? null
              : {
                  ivb: current[i].harpHelu.shape.ivb.value,
                  hb: current[i].harpHelu.shape.horizontalBreak.value,
                },
          league: null,
        }))

  return (
    <div className="flex flex-col gap-4">
      <FileUpload onLoad={loadFile} onClear={clear} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {example === null ? null : (
          <ChipGroup
            label={es.translator.example.title}
            options={[
              {
                key: example.key,
                label: es.translator.example.load,
                isActive: isExample,
                onPick: () => {
                  load(example)
                },
              },
            ]}
          />
        )}
        <ChipGroup
          label={es.translator.origin}
          options={ORIGINS.map((o) => ({
            key: o,
            label: es.translator.origins[o](formatNumber(densities[o], 3)),
            isActive: origin === o,
            onPick: () => {
              setOrigin(o)
              setEdited(true)
            },
          }))}
        />
        <ChipGroup
          label={es.sim.hand}
          options={HANDS.map((h) => ({
            key: h,
            label: es.sim.hands[h],
            isActive: hand === h,
            onPick: () => {
              setHand(h)
              setEdited(true)
            },
          }))}
        />
      </div>

      <div className="flex flex-col gap-1.5 border-l-[3px] border-(--color-altitude-extreme) bg-(--color-surface-card) px-4 py-3 text-[13px] text-(--color-text)">
        <p>{es.translator.originNote(formatNumber(densities.hh, 3), formatNumber(factor, 3))}</p>
        {isExtrapolation(origin) ? (
          <p className="text-(--color-text-muted)">{es.translator.extrapolation}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-3 gap-3">
          <Kpi label={es.translator.kpi.sea} value={show(sea)} />
          <Kpi label={es.translator.kpi.hh} value={show(hh)} />
          <Kpi label={es.translator.kpi.delta} value={show(delta, true)} />
        </div>
        <p className="text-[11px] text-(--color-text-muted)">
          {reason === null ? es.translator.kpi.weighted : es.sim.reasons[reason]}
        </p>
      </div>

      <ArsenalEditor rows={rows} onChange={edit} resetKey={loads} />

      <div role="status" className="text-[12px] text-(--color-text-muted)">
        {translation.status === 'error'
          ? es.sim.status[translation.kind]
          : translation.status === 'loading'
            ? es.sim.status.loading
            : null}
      </div>

      {current === null ? null : (
        <div className={`flex flex-col gap-4 ${isStale ? 'opacity-50' : ''}`}>
          <TranslationTable
            rows={rows}
            shares={shares}
            results={current}
            simulatorFrom={edited ? null : source}
          />
          {validation === null || source === null ? null : (
            <ValidationExample
              pitcherId={source.pitcherId}
              season={source.season}
              rows={validation}
            />
          )}
          <div className="max-w-[560px]">
            <ArsenalMap
              pitches={mapPitches}
              legend={{ sea: es.translator.map.sea, hh: es.translator.map.hh }}
              note={es.translator.map.note}
            />
          </div>
        </div>
      )}

      <p className="text-[12px] text-(--color-text-muted)">{es.translator.noRuns}</p>
    </div>
  )
}

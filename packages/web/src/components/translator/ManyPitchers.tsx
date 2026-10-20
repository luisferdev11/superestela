'use client'

import { useId, useState } from 'react'
import { MetricValue } from '@/components/metric/MetricValue'
import { RateValue } from '@/components/metric/RateValue'
import {
  DEFAULT_MANY_SORT,
  firstManyDirection,
  NO_MANY_FILTERS,
  toBand95,
  viewOf,
  type ManyFilters,
  type ManySortKey,
} from '@/domain/manyPitchers'
import { nextSort, type SortState } from '@/domain/tableSort'
import { formatNumber } from '@/domain/format'
import type { FileProblem } from '@/domain/translator'
import { arsenalScoresSchema, type ArsenalScores } from '@/sources/arsenalScores'
import { isBlank, uploadProblemOf } from '@/sources/arsenalSummary'
import { MAX_FILE_BYTES, readText } from './FileUpload'
import { FilePicker } from './FilePicker'
import { es } from '@/i18n/es'

const copy = es.translator.many

type State =
  | { readonly status: 'idle' }
  | { readonly status: 'reading' }
  | { readonly status: 'loaded'; readonly scores: ArsenalScores }
  | {
      readonly status: 'error'
      readonly problem: FileProblem | 'tooLarge' | 'unreachable'
      readonly columns: readonly string[]
    }

/** Las columnas en el orden de `copy.columns`; Mano no se ordena. */
const SORT_KEYS: readonly (ManySortKey | null)[] = [
  'pitcher',
  null,
  'n',
  'sea',
  'hh',
  'delta',
  'whiff',
  'tax',
]

const control =
  'h-8 border border-(--color-border-strong) bg-(--color-surface-card) px-2 text-[13px] text-(--color-text)'
// Base sin alineacion: con `text-right` en la base, un `text-left` agregado
// pierde segun el orden de Tailwind, no segun el orden de las clases.
const base = 'px-2 py-2 border-b border-(--color-border-hairline) tabular-nums'
const cell = `${base} text-right`
const cellLeft = `${base} text-left`

const ask = async (csv: string): Promise<State> => {
  if (isBlank(csv)) return { status: 'error', problem: 'empty', columns: [] }
  const response = await fetch('/api/arsenals/score', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ csv }),
  })
  const body: unknown = await response.json().catch(() => null)
  if (response.ok) return { status: 'loaded', scores: arsenalScoresSchema.parse(body) }
  return { status: 'error', ...uploadProblemOf(response.status, body) }
}

/**
 * El Traductor con varios lanzadores (14 de octubre): un archivo de otra liga,
 * una fila por lanzador con su Stuff+ en los dos aires, el whiff de su liga y
 * el Impuesto proyectado. La API puntua; aqui se filtra, se ordena y se dice
 * que es medido y que es proyectado.
 */
export const ManyPitchers = () => {
  const ids = { file: useId(), hand: useId(), search: useId() }
  const [state, setState] = useState<State>({ status: 'idle' })
  const [sort, setSort] = useState<SortState<ManySortKey>>(DEFAULT_MANY_SORT)
  const [filters, setFilters] = useState<ManyFilters>(NO_MANY_FILTERS)

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    if (file.size > MAX_FILE_BYTES) {
      setState({ status: 'error', problem: 'tooLarge', columns: [] })
      return
    }
    setState({ status: 'reading' })
    try {
      setState(await ask(await readText(file)))
    } catch (error: unknown) {
      console.error(error)
      setState({ status: 'error', problem: 'unreachable', columns: [] })
    }
  }

  const scores = state.status === 'loaded' ? state.scores : null
  const rows = scores === null ? [] : viewOf(scores.pitchers, filters, sort)
  const validation = scores?.taxValidation ?? null

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
        <label htmlFor={ids.file} className="text-[15px] font-bold">
          {copy.upload}
        </label>
        <FilePicker
          id={ids.file}
          onFile={(file) => {
            void handleFile(file)
          }}
        />
        <p className="text-[12px] text-(--color-text-muted)">{copy.hint}</p>
        <div role="status" className="flex flex-col gap-1 text-[13px]">
          {state.status === 'reading' ? (
            <p className="text-(--color-text-muted)">{copy.reading}</p>
          ) : null}
          {state.status === 'error' ? (
            <p className="font-semibold text-(--color-semantic-trap)">
              {es.translator.upload.problems[state.problem]}
              {state.columns.length > 0 ? ` ${state.columns.join(', ')}.` : null}
            </p>
          ) : null}
          {scores === null ? null : (
            <>
              <p>{copy.summary(scores.pitchers.length, scores.nRows.toLocaleString('es-MX'))}</p>
              <p className="text-(--color-text-muted)">
                {copy.left(
                  scores.fewPitches,
                  scores.minPitches,
                  formatNumber(scores.unsupportedRows, 0),
                  formatNumber(scores.missingFeatureRows, 0),
                )}
              </p>
              {scores.hasSwings ? null : (
                <p className="text-(--color-text-muted)">{copy.noSwings}</p>
              )}
              {scores.stuffPlusShown ? null : <p>{copy.hidden}</p>}
            </>
          )}
        </div>
      </section>

      {scores === null ? null : (
        <section className="flex flex-col gap-3 border border-(--color-border) bg-(--color-surface-card) p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={ids.hand}
                className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase"
              >
                {copy.hand}
              </label>
              <select
                id={ids.hand}
                className={control}
                value={filters.hand ?? ''}
                onChange={(event) => {
                  setFilters({
                    ...filters,
                    hand: event.target.value === '' ? null : event.target.value,
                  })
                }}
              >
                <option value="">{copy.all}</option>
                <option value="Right">{es.throws.Right}</option>
                <option value="Left">{es.throws.Left}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor={ids.search}
                className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase"
              >
                {copy.search}
              </label>
              <input
                id={ids.search}
                type="search"
                className={`${control} w-44`}
                value={filters.query}
                onChange={(event) => {
                  setFilters({ ...filters, query: event.target.value })
                }}
              />
            </div>
          </div>

          <p className="text-[12px]">
            {validation === null
              ? copy.taxNoteUnchecked
              : copy.taxNote(
                  validation.n,
                  formatNumber(validation.pearsonR, 2),
                  formatNumber(validation.meanProjected, 2),
                  formatNumber(validation.meanMeasured, 2),
                )}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {copy.columns.map((column, index) => {
                    const key = SORT_KEYS[index] ?? null
                    const isActive = key !== null && sort.key === key
                    return (
                      <th
                        key={column}
                        scope="col"
                        title={copy.columnHelp[index]}
                        aria-sort={
                          isActive
                            ? sort.direction === 'desc'
                              ? 'descending'
                              : 'ascending'
                            : undefined
                        }
                        className={`border-b border-(--color-border-strong) px-2 pb-2 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase ${
                          index === 0 ? 'text-left' : 'text-right'
                        } ${isActive ? 'text-(--color-ink)' : 'text-(--color-text-muted)'}`}
                      >
                        {key === null ? (
                          column
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSort(nextSort(sort, key, firstManyDirection(key)))
                            }}
                            className="cursor-pointer border-0 bg-transparent p-0 text-inherit uppercase hover:underline"
                          >
                            {column}
                            <span aria-hidden="true" className="pl-1">
                              {isActive ? (sort.direction === 'desc' ? '▼' : '▲') : '↕'}
                            </span>
                          </button>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.pitcherId}>
                    <td className={`${cellLeft} font-semibold`}>{p.pitcherId}</td>
                    <td className={cell}>{es.handShort[p.pitcherHand] ?? p.pitcherHand}</td>
                    <td className={cell}>{formatNumber(p.n, 0)}</td>
                    <td className={cell}>
                      <MetricValue metric={toBand95(p.stuffPlusSea)} />
                    </td>
                    <td className={cell}>
                      <MetricValue metric={toBand95(p.stuffPlusHh)} />
                    </td>
                    <td className={cell}>
                      <MetricValue metric={toBand95(p.altitudeDelta)} />
                    </td>
                    <td className={cell}>
                      <RateValue
                        metric={
                          p.whiffPerSwing === null
                            ? null
                            : {
                                value: 100 * p.whiffPerSwing.value,
                                se: 100 * p.whiffPerSwing.ci95,
                              }
                        }
                        compact
                      />
                    </td>
                    <td className={cell}>
                      <MetricValue metric={toBand95(p.projectedTax)} digits={2} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-(--color-text-muted)">{copy.empty}</p>
          ) : null}
          <p className="text-[11px] text-(--color-text-muted)">{copy.band}</p>
        </section>
      )}
    </div>
  )
}

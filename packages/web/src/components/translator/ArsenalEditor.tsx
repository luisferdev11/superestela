'use client'

import { CONTROLS, PITCH_TYPES, type Control } from '@/domain/simulator'
import { MAX_ROWS, checkRows, type TranslatorRow } from '@/domain/translator'
import { es } from '@/i18n/es'

// Sin borde ni fondo en la base: con los dos aqui, el rojo de una celda invalida
// perdia contra el fondo normal por el orden de Tailwind.
const cell = 'w-[72px] border px-1.5 py-1 text-right text-[13px] tabular-nums'
const bad = 'border-(--color-diablos) bg-(--color-diablos-wash)'
const ok = 'border-(--color-border) bg-(--color-surface-card)'

/**
 * La tabla que se captura: un pitch por fila, sus ocho perillas y su uso. Las
 * celdas no estan controladas mientras se teclea (un «-» a medias no es un
 * numero); `resetKey` las reinicia cuando llega un arsenal nuevo o se quita una
 * fila. Lo que esta fuera de rango se marca en la celda, no en un aviso suelto.
 */
export const ArsenalEditor = ({
  rows,
  onChange,
  resetKey,
}: {
  readonly rows: readonly TranslatorRow[]
  /** `remount`: la tabla cambio de forma (se quito una fila) y las celdas se reinician. */
  readonly onChange: (rows: TranslatorRow[], remount?: boolean) => void
  readonly resetKey: number
}) => {
  const checks = checkRows(rows)
  const set = (index: number, patch: Partial<TranslatorRow>): void => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  const unused = PITCH_TYPES.filter((t) => !rows.some((r) => r.pitchType === t))
  const outOfRange = checks.some((c) => c.problems.has('outOfRange'))
  const badUsage = checks.some((c) => c.problems.has('badUsage'))
  const duplicate = checks.some((c) => c.problems.has('duplicateType'))
  const noUsage = rows.length > 0 && !rows.some((r) => r.usage > 0)

  return (
    <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold">{es.translator.editor.title}</h2>
        <span className="text-[11px] text-(--color-text-muted)">{es.translator.editor.note}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-[13px]">
          <thead>
            <tr className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
              <th className="px-1.5 pb-1.5 text-left">{es.translator.editor.pitch}</th>
              <th className="px-1.5 pb-1.5 text-right">{es.translator.editor.usage}</th>
              {CONTROLS.map((c) => (
                <th key={c} className="px-1.5 pb-1.5 text-right" title={es.sim.controls[c]}>
                  {es.translator.editor.short[c]}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const check = checks[i]
              const key = `${String(resetKey)}-${String(i)}`
              const isBad = (control: Control | 'usage'): boolean =>
                control === 'usage'
                  ? check?.problems.has('badUsage') === true
                  : check?.cells.has(control) === true
              const numeric = (control: Control | 'usage', value: number) => (
                <input
                  key={`${key}-${control}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  aria-label={`${r.pitchType} · ${
                    control === 'usage' ? es.translator.editor.usage : es.sim.controls[control]
                  }`}
                  aria-invalid={isBad(control)}
                  defaultValue={Number.isFinite(value) ? value : ''}
                  className={`${cell} ${isBad(control) ? bad : ok}`}
                  onChange={(e) => {
                    set(i, {
                      [control]: e.target.value === '' ? Number.NaN : Number(e.target.value),
                    })
                  }}
                />
              )
              return (
                <tr key={key} className="border-t border-(--color-border-hairline)">
                  <td className="py-1.5 pr-1.5">
                    <select
                      aria-label={`${es.translator.editor.pitch} ${String(i + 1)}`}
                      value={r.pitchType}
                      className={`border px-1.5 py-1 text-[13px] ${
                        check?.problems.has('duplicateType') === true ? bad : ok
                      }`}
                      onChange={(e) => {
                        const picked = PITCH_TYPES.find((t) => t === e.target.value)
                        if (picked !== undefined) set(i, { pitchType: picked })
                      }}
                    >
                      {PITCH_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1.5 py-1.5">{numeric('usage', r.usage)}</td>
                  {CONTROLS.map((c) => (
                    <td key={c} className="px-1.5 py-1.5">
                      {numeric(c, r[c])}
                    </td>
                  ))}
                  <td className="py-1.5 pl-1.5">
                    <button
                      type="button"
                      disabled={rows.length <= 1}
                      aria-label={es.translator.editor.remove(r.pitchType)}
                      title={es.translator.editor.remove(r.pitchType)}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center border border-(--color-border-strong) bg-(--color-surface-card) text-[20px] leading-none text-(--color-text) hover:border-(--color-diablos) hover:text-(--color-diablos) disabled:cursor-not-allowed disabled:opacity-30"
                      onClick={() => {
                        onChange(
                          rows.filter((_, j) => j !== i),
                          true,
                        )
                      }}
                    >
                      {'×'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={rows.length >= MAX_ROWS || unused.length === 0}
          className="cursor-pointer border border-(--color-ink) bg-(--color-surface-card) px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            const pitchType = unused[0]
            const base = rows[0]
            if (pitchType === undefined || base === undefined) return
            onChange([...rows, { ...base, pitchType, usage: 0 }])
          }}
        >
          {es.translator.editor.add}
        </button>
        <span role="alert" className="text-[12px] text-(--color-diablos)">
          {outOfRange
            ? es.translator.editor.outOfRange
            : badUsage
              ? es.translator.editor.badUsage
              : duplicate
                ? es.translator.editor.duplicate
                : noUsage
                  ? es.translator.editor.noUsage
                  : null}
        </span>
      </div>
    </section>
  )
}

import { RoleChip } from '@/components/chip/RoleChip'
import { MIN_PITCHES_FOR_SCORE } from '@/domain/constants'
import { hasGap, type SeasonRow } from '@/domain/pitcher'
import { es } from '@/i18n/es'

// Base sin alineacion: con `text-right` en la base, un `text-left` agregado
// pierde segun el orden de Tailwind, no segun el orden de las clases.
const base = 'border-b border-(--color-border-hairline) px-3 py-2 tabular-nums'
const cell = `${base} text-right`
const cellLeft = `${base} text-left`

/** La frase que explica una fila sin score. Una temporada con score no necesita una. */
const explain = (row: SeasonRow): string | null => {
  if (row.status === 'absent') return es.ficha.seasons.gap(row.season)
  if (row.nPitchesHh === null || row.nPitchesSea === null) return null
  if (row.status === 'shortSea')
    return es.ficha.seasons.shortSea(row.season, row.nPitchesHh, row.nPitchesSea)
  if (row.status === 'thinArsenal') return es.ficha.seasons.thinArsenal(row.season, row.nPitchesHh)
  if (row.status === 'shortHh')
    return es.ficha.seasons.shortHh(row.season, row.nPitchesHh, row.nPitchesSea)
  return null
}

/**
 * La trayectoria completa, con el hueco a la vista (ADR 0005): un lanzador que
 * se fue un ano y volvio son dos mediciones, no un promedio de dos personas.
 */
export const SeasonTable = ({
  rows,
  pitchersWithGap,
}: {
  readonly rows: readonly SeasonRow[]
  readonly pitchersWithGap: number
}) => {
  const notes = rows.map(explain).filter((n): n is string => n !== null)
  return (
    <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-bold">{es.ficha.seasons.title}</h2>
        <span className="text-[11px] text-(--color-text-muted)">
          {es.ficha.seasons.rule(MIN_PITCHES_FOR_SCORE)}
        </span>
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-[10px] tracking-widest text-(--color-text-muted) uppercase">
            {es.ficha.seasons.columns.map((c, i) => (
              <th key={c} className={i === 0 || i >= 3 ? cellLeft : cell}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.season}
              className={row.status === 'absent' ? 'text-(--color-text-muted)' : ''}
            >
              <td className={cellLeft}>{row.season}</td>
              <td className={cell}>{row.nPitchesHh ?? '—'}</td>
              <td className={cell}>{row.nPitchesSea ?? '—'}</td>
              <td className={cellLeft}>
                {row.status === 'scored' ? <RoleChip role={row.role} /> : '—'}
              </td>
              <td
                className={`${cellLeft} ${row.status === 'scored' ? '' : 'text-(--color-semantic-inconclusive)'}`}
              >
                {es.ficha.seasons.status[row.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {notes.map((note) => (
        <p key={note} className="text-[12px] text-(--color-text-muted)">
          {note}
        </p>
      ))}
      {hasGap(rows) ? (
        <p className="text-[12px] text-(--color-text-muted)">
          {es.ficha.seasons.gapContext(pitchersWithGap)}
        </p>
      ) : null}
    </section>
  )
}

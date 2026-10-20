import Link from 'next/link'
import { MetricValue } from '@/components/metric/MetricValue'
import { InconclusiveValue } from '@/components/metric/InconclusiveValue'
import { RateValue } from '@/components/metric/RateValue'
import { RoleChip } from '@/components/chip/RoleChip'
import { TrapFlag } from '@/components/chip/TrapFlag'
import { LARGE_DELTA, isStaleSeason } from '@/domain/emphasis'
import { formatNumber, formatSigned } from '@/domain/format'
import { fichaHref } from '@/domain/pitcher'
import { focusOf } from '@/domain/ranking'
import type { RadarCard } from '@/domain/cohort'
import { es } from '@/i18n/es'

// Base sin alineacion: con `text-right` en la base, un `text-left` agregado
// pierde segun el orden de Tailwind, no segun el orden de las clases.
const base = 'px-2 py-2 border-b border-(--color-border-hairline)'
const cell = `${base} text-right`
const cellLeft = `${base} text-left`

/**
 * Una fila del Radar. Sin pitch elegido, las columnas de Stuff+, Δ y uso son
 * las del lanzador y su pitch principal; con uno, las de ese pitch (`focusOf`).
 */
export const RadarRow = ({
  card,
  latestSeason,
  pitch = null,
}: {
  readonly card: RadarCard
  readonly latestSeason: number
  readonly pitch?: string | null
}) => {
  const focus = focusOf(card, pitch)
  const isLargeDelta = focus.delta !== null && focus.delta <= LARGE_DELTA
  const stale = isStaleSeason(card, latestSeason)

  return (
    <tr className={card.altitudeTrap ? 'bg-(--color-diablos-wash)' : undefined}>
      <td className={`${cellLeft} whitespace-nowrap`}>
        <Link
          href={fichaHref(card.pitcherId, card.season)}
          className={`border-b border-(--color-border-underline) text-inherit no-underline ${card.altitudeTrap ? 'font-semibold' : ''}`}
        >
          {card.pitcherId}
        </Link>{' '}
        <TrapFlag trap={card.altitudeTrap} />
      </td>
      <td className={`${cell} ${stale ? 'text-(--color-semantic-stale)' : 'text-(--color-text)'}`}>
        {card.season}
      </td>
      <td className={cell}>
        <span title={es.handLong[card.throws] ?? card.throws}>
          {es.handShort[card.throws] ?? card.throws}
        </span>
      </td>
      <td className={cell}>
        {focus.hh === null ? es.noSampleShort : <MetricValue metric={focus.hh} />}
      </td>
      <td className={`${cell} text-(--color-text-muted)`}>
        {focus.sea === null ? es.noSampleShort : formatNumber(focus.sea.value)}
      </td>
      <td className={`${cell} ${isLargeDelta ? 'font-semibold text-(--color-diablos)' : ''}`}>
        {focus.delta === null ? '' : formatSigned(focus.delta)}
      </td>
      <td className={cell}>
        {card.altitudeTax === null ? (
          <InconclusiveValue short />
        ) : (
          <MetricValue metric={card.altitudeTax} digits={2} />
        )}
      </td>
      <td className={cell}>
        <RateValue metric={card.ratesHh.kMinusBbPct} compact />
      </td>
      <td className={cell}>
        <RateValue metric={card.ratesHh.whiffPerSwing} compact />
      </td>
      <td className={cellLeft}>
        <RoleChip role={card.role} />
      </td>
      <td className={cellLeft}>{focus.pitch ?? ''}</td>
      <td className={cell}>{focus.usagePct === null ? '' : `${formatNumber(focus.usagePct)}%`}</td>
    </tr>
  )
}

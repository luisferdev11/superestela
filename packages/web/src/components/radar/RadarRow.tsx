import Link from 'next/link'
import { MetricValue } from '@/components/metric/MetricValue'
import { InconclusiveValue } from '@/components/metric/InconclusiveValue'
import { RoleChip } from '@/components/chip/RoleChip'
import { TrapFlag } from '@/components/chip/TrapFlag'
import { dominantPitch } from '@/domain/arsenal'
import { hasLargeDelta, isStaleSeason } from '@/domain/emphasis'
import { formatNumber, formatSigned } from '@/domain/format'
import { fichaHref } from '@/domain/pitcher'
import type { PitcherSeason } from '@/domain/types'

const cell = 'px-3 py-2 text-right border-b border-(--color-border-hairline)'
const cellLeft = `${cell} text-left`

export const RadarRow = ({
  card,
  latestSeason,
}: {
  readonly card: PitcherSeason
  readonly latestSeason: number
}) => {
  const pitch = dominantPitch(card)
  const stale = isStaleSeason(card, latestSeason)

  return (
    <tr className={card.altitudeTrap ? 'bg-(--color-diablos-wash)' : undefined}>
      <td className={cellLeft}>
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
      <td className={cell}>{card.throws}</td>
      <td className={cell}>
        <MetricValue metric={card.stuffPlusHh} />
      </td>
      <td className={`${cell} text-(--color-text-muted)`}>
        {formatNumber(card.stuffPlusSea.value)}
      </td>
      <td
        className={`${cell} ${hasLargeDelta(card) ? 'font-semibold text-(--color-diablos)' : ''}`}
      >
        {formatSigned(card.stuffPlusDelta)}
      </td>
      <td className={cell}>
        {card.altitudeTax === null ? (
          <InconclusiveValue short />
        ) : (
          <MetricValue metric={card.altitudeTax} digits={2} />
        )}
      </td>
      <td className={cellLeft}>
        <RoleChip role={card.role} />
      </td>
      <td className={cellLeft}>{pitch?.pitch ?? ''}</td>
      <td className={cell}>{pitch === null ? '' : `${formatNumber(pitch.usagePct)}%`}</td>
    </tr>
  )
}

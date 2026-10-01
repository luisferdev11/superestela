import { RateValue } from '@/components/metric/RateValue'
import { MIN_PLATE_APPEARANCES_FOR_RATE, MIN_SWINGS_FOR_RATE } from '@/domain/constants'
import { formatNumber } from '@/domain/format'
import type { Environment, Outcomes, SeasonEntry } from '@/domain/types'
import { es } from '@/i18n/es'

const base = 'border-b border-(--color-border-hairline) px-3 py-2 tabular-nums'
const cell = `${base} text-right`
const cellLeft = `${base} text-left`

const ENVIRONMENTS: readonly Environment[] = ['hh', 'sea']

const outcomesOf = (entry: SeasonEntry, env: Environment): Outcomes =>
  env === 'hh' ? entry.outcomesHh : entry.outcomesSea

const show = (o: Outcomes, pick: (o: Outcomes) => number | undefined): string => {
  const value = pick(o)
  return value === undefined ? es.insufficientSampleShort : formatNumber(value)
}

/**
 * K%, BB%, K-BB% y whiff por swing de cada temporada, en cada entorno, con su
 * banda. Es lo que Diablos dijo que mira primero (Q&A, 30 sep). Es conteo, no
 * modelo, y se dice; la liga en cada entorno da la referencia.
 */
export const OutcomesTable = ({
  entries,
  league,
}: {
  readonly entries: readonly SeasonEntry[]
  readonly league: Readonly<Record<Environment, Outcomes>> | null
}) => (
  <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
    <div className="flex flex-col gap-0.5">
      <h2 className="text-[15px] font-bold">{es.ficha.outcomes.title}</h2>
      <p className="text-[12px] text-(--color-text-muted)">{es.ficha.outcomes.subtitle}</p>
    </div>
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="text-[10px] tracking-widest text-(--color-text-muted) uppercase">
          {es.ficha.outcomes.columns.map((c, i) => (
            <th key={c} className={i < 2 ? cellLeft : cell}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...entries]
          .sort((a, b) => a.season - b.season)
          .flatMap((entry) =>
            ENVIRONMENTS.map((env) => {
              const o = outcomesOf(entry, env)
              return (
                <tr key={`${String(entry.season)}-${env}`}>
                  <td className={cellLeft}>{env === 'hh' ? entry.season : ''}</td>
                  <td className={cellLeft}>{es.ficha.outcomes.environment[env]}</td>
                  <td className={cell}>{o.plateAppearances}</td>
                  <td className={cell}>
                    <RateValue metric={o.kPct} />
                  </td>
                  <td className={cell}>
                    <RateValue metric={o.bbPct} />
                  </td>
                  <td className={cell}>
                    <RateValue metric={o.kMinusBbPct} />
                  </td>
                  <td className={cell}>
                    <RateValue metric={o.whiffPerSwing} />
                  </td>
                </tr>
              )
            }),
          )}
      </tbody>
    </table>
    {league === null
      ? null
      : ENVIRONMENTS.map((env) => (
          <p key={env} className="text-[12px] text-(--color-text-muted)">
            {es.ficha.outcomes.league(
              es.ficha.outcomes.environment[env].toLowerCase(),
              show(league[env], (o) => o.kMinusBbPct?.value),
              show(league[env], (o) => o.whiffPerSwing?.value),
            )}
          </p>
        ))}
    <p className="text-[11px] text-(--color-text-muted)">
      {es.ficha.outcomes.rule(MIN_PLATE_APPEARANCES_FOR_RATE, MIN_SWINGS_FOR_RATE)}
    </p>
  </section>
)

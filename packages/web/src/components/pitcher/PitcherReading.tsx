import { formatNumber, formatSignedMetric } from '@/domain/format'
import { readingOf } from '@/domain/reading'
import type { PitcherSeason } from '@/domain/types'
import type { ScaleKind } from '@/domain/scale'
import { es } from '@/i18n/es'

/**
 * El cierre de la Ficha (`Ficha.dc.html`): que hacer con el lanzador y por
 * que. Cada cifra sale de la tarjeta; la regla del veredicto se declara en
 * pantalla porque es provisional, de producto y no del modelo.
 */
export const PitcherReading = ({
  card,
  scale = 'league',
}: {
  readonly card: PitcherSeason
  /** Como se define el 100 (`domain/scale.ts`): cambia como se lee el Δ. */
  readonly scale?: ScaleKind
}) => {
  const { verdict, main, lever } = readingOf(card)
  return (
    <section className="flex flex-col gap-2 bg-(--color-ink) px-6 py-5 text-white">
      <h2 className="text-[10px] font-bold tracking-widest text-(--color-text-faint) uppercase">
        {es.ficha.reading.title}
      </h2>
      <p className="text-[20px] leading-snug font-bold">{es.ficha.reading.verdict[verdict]}</p>
      {main === null ? null : (
        <p className="text-[13px] leading-relaxed">
          {es.scale[scale].readingMain(
            main.pitch,
            formatNumber(main.usagePct),
            formatSignedMetric(main.delta),
          )}
        </p>
      )}
      {lever === null ? null : (
        <p className="text-[13px] leading-relaxed">
          {es.ficha.reading.lever(
            lever.best.pitch,
            formatSignedMetric(lever.best.delta),
            lever.worst.pitch,
            formatSignedMetric(lever.worst.delta),
          )}
        </p>
      )}
      <p className="pt-1 text-[11px] leading-snug text-(--color-text-faint)">
        {es.ficha.reading.rule}
      </p>
    </section>
  )
}

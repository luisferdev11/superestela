import type { Route } from 'next'
import Link from 'next/link'
import { RoleChip } from '@/components/chip/RoleChip'
import { FICHA_TABS, type FichaTab } from '@/domain/navigation'
import { fichaHref, tabHref } from '@/domain/pitcher'
import { SeasonSelect, type SeasonOption } from './SeasonSelect'
import type { PitcherSeason, SeasonEntry } from '@/domain/types'
import { es } from '@/i18n/es'

/**
 * Las temporadas del selector: las que tienen score llevan a la misma pestana;
 * las que no, aparecen deshabilitadas con sus conteos, para que se vea por que
 * no se pueden abrir en vez de que el selector parezca roto.
 */
const seasonOptions = (
  scored: readonly number[],
  history: readonly SeasonEntry[],
  hrefOf: (season: number) => Route,
): SeasonOption[] => {
  const unscored = history.filter((e) => !scored.includes(e.season))
  return [
    ...scored.map((season) => ({ season, href: hrefOf(season), sample: null })),
    ...unscored.map((e) => ({
      season: e.season,
      href: null,
      sample: { hh: e.nPitchesHh, sea: e.nPitchesSea },
    })),
  ].sort((a, b) => b.season - a.season)
}

const tabClass = (active: boolean): string =>
  active
    ? 'border-b-2 border-(--color-diablos) pb-2 text-[13px] font-semibold text-(--color-text-strong) no-underline'
    : 'border-b-2 border-transparent pb-2 text-[13px] text-(--color-text-muted) no-underline'

/**
 * La cabecera de la Ficha: de donde viene (el Radar), que temporada se ve y en
 * que pestana. El selector de temporada lleva a la misma pestana en otro ano;
 * solo ofrece temporadas con score. La trayectoria completa, con sus huecos,
 * esta en la tabla de temporadas.
 */
export const PitcherHeader = ({
  card,
  seasons,
  history = [],
  tab,
  tabHrefs,
}: {
  readonly card: PitcherSeason
  readonly seasons: readonly number[]
  /** Every season he pitched, scored or not: the selector shows why one cannot be opened. */
  readonly history?: readonly SeasonEntry[]
  readonly tab: FichaTab
  /** La ruta de cada pestana que ya existe; las demas se muestran sin enlace. */
  readonly tabHrefs: Partial<Record<FichaTab, Route>>
}) => (
  <header className="flex flex-col gap-4">
    <nav aria-label={es.ficha.breadcrumb} className="flex items-center gap-2 text-[12px]">
      <Link href="/radar" className="text-(--color-text-muted)">
        {es.ficha.breadcrumb}
      </Link>
      <span className="text-(--color-text-faint)">/</span>
      <span className="font-semibold">{card.pitcherId}</span>
      <span className="text-(--color-text-faint)">/</span>
      {seasons.map((season) =>
        season === card.season ? (
          <span key={season} aria-current="page" className="font-semibold">
            {season}
          </span>
        ) : (
          <Link key={season} href={fichaHref(card.pitcherId, season)}>
            {season}
          </Link>
        ),
      )}
    </nav>

    <div className="flex gap-6 border-b border-(--color-border)">
      {FICHA_TABS.map((id) => {
        const href = tabHrefs[id]
        return href === undefined ? (
          <span key={id} aria-disabled="true" title={es.nav.pending} className={tabClass(false)}>
            {es.ficha.tabs[id]}
          </span>
        ) : (
          <Link
            key={id}
            href={href}
            aria-current={id === tab ? 'page' : undefined}
            className={tabClass(id === tab)}
          >
            {es.ficha.tabs[id]}
          </Link>
        )
      })}
    </div>

    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">
          {es.ficha.heading(card.pitcherId, card.season)}
        </h1>
        <p className="mt-0.5 text-[13px] text-(--color-text-muted)">
          {es.ficha.sample(
            es.ficha.hands[card.throws] ?? card.throws,
            card.nPitchesHh,
            card.nPitchesSea,
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[12px]">
        <SeasonSelect
          current={card.season}
          options={seasonOptions(seasons, history, (season) =>
            tabHref(tab, card.pitcherId, season),
          )}
        />
        <span className="border border-(--color-border) bg-(--color-surface-card) px-2.5 py-1">
          <RoleChip role={card.role} />
        </span>
        {card.altitudeTrap ? (
          <span
            title={es.trapDescription}
            className="bg-(--color-diablos) px-2.5 py-1 font-semibold text-white"
          >
            {es.trap}
          </span>
        ) : null}
      </div>
    </div>
  </header>
)

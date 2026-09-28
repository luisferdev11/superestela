import Link from 'next/link'
import { ComplianceNote } from './ComplianceNote'
import { DensityBar } from './DensityBar'
import type { DensityScale } from '@/domain/density'
import { es } from '@/i18n/es'
import { NAV_GROUPS } from '@/domain/navigation'

/**
 * El rail del prototipo. Las pantallas que todavia no existen se listan pero
 * **no son enlaces**: `aria-disabled` y sin `href`, porque una navegacion que
 * no lleva a ningun lado es peor que una lista corta — y `docs/02` ya cuenta
 * que la P8 nacio justo de un elemento del rail «en gris, sin pantalla detras».
 */
export const NavRail = ({
  scale,
  nPitches,
  seasons,
  current,
}: {
  readonly scale: DensityScale
  readonly nPitches: number
  readonly seasons: readonly number[]
  readonly current: string
}) => (
  <div className="sticky top-0 flex h-screen w-[216px] shrink-0 flex-col justify-between gap-6 overflow-y-auto bg-(--color-ink) py-6">
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5 px-5">
        <div className="flex flex-col">
          <div className="text-[9px] leading-none font-bold tracking-[0.28em] text-(--color-text-faint)">
            {es.brand.top}
          </div>
          <div className="font-display text-[26px] leading-[1.06] tracking-[0.01em] text-white">
            {es.brand.bottom}
          </div>
        </div>
        <div className="h-8 w-[3px] bg-(--color-diablos)" />
      </div>

      <nav className="flex flex-col gap-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-px">
            <div className="px-5 pb-1.5 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
              {es.nav.groups[group.id]}
            </div>
            {group.items.map((item) =>
              item.href === null ? (
                <span
                  key={item.id}
                  aria-disabled="true"
                  title={es.nav.pending}
                  className="block border-l-[3px] border-transparent py-2 pr-5 pl-[17px] text-[13px] text-(--color-text-muted)"
                >
                  {es.nav.items[item.id]}
                </span>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={item.href === current ? 'page' : undefined}
                  className={
                    item.href === current
                      ? 'block border-l-[3px] border-(--color-diablos) bg-(--color-ink-raised) py-2 pr-5 pl-[17px] text-[13px] font-semibold text-white no-underline'
                      : 'block border-l-[3px] border-transparent py-2 pr-5 pl-[17px] text-[13px] text-(--color-text-faint) no-underline'
                  }
                >
                  {es.nav.items[item.id]}
                </Link>
              ),
            )}
          </div>
        ))}
      </nav>
    </div>

    <div className="flex flex-col gap-2 px-5">
      <ComplianceNote />
      <DensityBar scale={scale} />
      <p className="pt-1 text-[10px] leading-relaxed text-(--color-text-muted)">
        {es.baselineNote(nPitches, seasons.length)}
      </p>
    </div>
  </div>
)

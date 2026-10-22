import Link from 'next/link'
import { IS_STATIC } from '@/sources/apiClient'
import { es } from '@/i18n/es'

/**
 * La franja de la version en linea (GitHub Pages): dice que es estatica, por
 * que, y como verla completa. Fuera de esa compilacion no dibuja nada.
 */
export const StaticBanner = () =>
  IS_STATIC ? (
    <div className="border-b-2 border-(--color-diablos) bg-(--color-ink) px-6 py-2 text-[12px] leading-snug text-white">
      <span className="font-bold">{es.staticSite.banner}</span> {es.staticSite.detail}{' '}
      <Link href="/correr" className="font-semibold text-white underline">
        {es.staticSite.repo}
      </Link>
    </div>
  ) : null

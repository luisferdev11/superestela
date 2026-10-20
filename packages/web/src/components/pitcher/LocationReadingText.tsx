import type { LocationChange, LocationReading } from '@/domain/location'
import { formatNumber, formatSigned } from '@/domain/format'
import { es } from '@/i18n/es'

const change = (c: LocationChange): string => `${formatSigned(c.value)} ± ${formatNumber(c.ci95)}`

/** La lectura de la ubicacion: el veredicto y los dos cambios con su banda. */
export const LocationReadingText = ({ reading }: { readonly reading: LocationReading }) => (
  <>
    <p className="text-[13px] font-bold">{es.ficha.location.read.verdict[reading.verdict]}</p>
    <p className="text-[13px] text-(--color-text-muted)">
      {es.ficha.location.read.changes(change(reading.heightIn), change(reading.zonePp))}
    </p>
  </>
)

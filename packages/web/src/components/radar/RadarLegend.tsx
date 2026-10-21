import { es } from '@/i18n/es'

/**
 * El pie de la tabla. No es decoracion: es donde la pantalla declara que la
 * bandera y el ambar significan algo, y con que denominador. Sin esto la codificacion por color queda sin explicar, que es
 * exactamente lo que `docs/02` seccion 1 prohibe.
 */
export const RadarLegend = ({
  shown,
  total,
}: {
  readonly shown: number
  readonly total: number
}) => (
  <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-strong) pt-3.5">
    <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-text-muted)">
      <span className="font-bold text-(--color-semantic-trap)" aria-hidden="true">
        {'▌'}
      </span>
      <span>{es.legend.trap}</span>
      <span className="pl-4 text-(--color-semantic-stale)">{es.legend.stale}</span>
    </div>
    <div className="text-xs text-(--color-text-muted)">{es.legend.showing(shown, total)}</div>
  </div>
)

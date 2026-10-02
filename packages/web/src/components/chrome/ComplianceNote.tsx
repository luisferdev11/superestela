import { es } from '@/i18n/es'

/**
 * Las condiciones del reglamento, a la vista en cada pantalla. `docs/03`
 * seccion 9 pide la prohibicion de apuestas «declarada en el producto, no
 * escondida en un pie de pagina»: por eso va en el rail, con titulo y borde
 * de marca, y no en letra chica al fondo del contenido.
 */
export const ComplianceNote = () => (
  <section
    aria-labelledby="compliance-title"
    className="border-l-[3px] border-(--color-diablos) bg-(--color-ink-raised) py-2.5 pr-3 pl-3"
  >
    <h2
      id="compliance-title"
      className="text-[10px] font-bold tracking-widest text-(--color-text-faint) uppercase"
    >
      {es.compliance.title}
    </h2>
    <ul className="mt-1.5 flex flex-col gap-1">
      {es.compliance.rules.map((rule) => (
        <li key={rule} className="text-[11px] leading-snug text-white">
          {rule}
        </li>
      ))}
    </ul>
  </section>
)

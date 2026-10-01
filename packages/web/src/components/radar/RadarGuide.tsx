import { MIN_PITCHES_FOR_SCORE, MIN_PLATE_APPEARANCES_FOR_RATE } from '@/domain/constants'
import type { ScaleKind } from '@/domain/scale'
import { es } from '@/i18n/es'

/**
 * «Como leer esta tabla», para quien no vive de la sabermetria (Diablos lo pidio
 * en el Q&A: claridad para una audiencia no tecnica). Es un `<details>` nativo:
 * se abre con teclado y lector de pantalla sin una linea de JavaScript.
 */
export const RadarGuide = ({ scale = 'league' }: { readonly scale?: ScaleKind }) => (
  <details className="border border-(--color-border) bg-(--color-surface-card) px-5 py-3 text-[13px]">
    <summary className="cursor-pointer text-[12px] font-semibold">{es.guide.title}</summary>
    <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-2">
      {[
        { term: es.guide.stuffPlusTerm, text: es.scale[scale].stuffPlus },
        ...es.guide.items,
        {
          term: es.guide.insufficient.term,
          text: es.guide.insufficientText(MIN_PITCHES_FOR_SCORE, MIN_PLATE_APPEARANCES_FOR_RATE),
        },
      ].map((item) => (
        <div key={item.term} className="flex flex-col gap-0.5">
          <dt className="font-semibold">{item.term}</dt>
          <dd className="m-0 text-(--color-text-muted)">{item.text}</dd>
        </div>
      ))}
    </dl>
  </details>
)

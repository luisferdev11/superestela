import 'server-only'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { projectionsPath } from './paths'
import type { PitcherProjection, Projections } from '@/domain/projection'

const target = z
  .object({
    ivb: z.number(),
    ivb_se: z.number().positive(),
    horizontal_break: z.number(),
    horizontal_break_se: z.number().positive(),
  })
  .strict()

const shape = z.object({ ivb: z.number(), horizontal_break: z.number() })

/** El contrato de `analysis/projection_evidence.py`, en Zod y estricto. */
export const projectionsSchema = z
  .object({
    densities: z.object({ sea: z.number(), medium: z.number(), hh: z.number() }).strict(),
    factors: z.object({ medium: z.number(), hh: z.number() }).strict(),
    pitchers: z.record(
      z.string(),
      z
        .object({
          pitcher_id: z.string(),
          season: z.number().int(),
          pitcher_hand: z.string(),
          pitches: z.array(
            z
              .object({
                pitch_type: z.string(),
                n: z.number().int().nonnegative(),
                usage: z.number().min(0).max(1),
                sea: shape.strict(),
                projected: z.object({ medium: target, hh: target }).strict(),
                measured_hh: shape
                  .extend({ n: z.number().int().nonnegative() })
                  .strict()
                  .nullable(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict()

type Raw = z.infer<typeof projectionsSchema>

const toMetric = (value: number, se: number) => ({ value, se })

const toPitcher = (key: string, raw: Raw['pitchers'][string]): PitcherProjection => ({
  key,
  pitcherId: raw.pitcher_id,
  season: raw.season,
  pitches: raw.pitches.map((p) => ({
    pitchType: p.pitch_type,
    n: p.n,
    usage: p.usage,
    sea: { ivb: p.sea.ivb, horizontalBreak: p.sea.horizontal_break },
    projected: {
      medium: {
        ivb: toMetric(p.projected.medium.ivb, p.projected.medium.ivb_se),
        horizontalBreak: toMetric(
          p.projected.medium.horizontal_break,
          p.projected.medium.horizontal_break_se,
        ),
      },
      hh: {
        ivb: toMetric(p.projected.hh.ivb, p.projected.hh.ivb_se),
        horizontalBreak: toMetric(
          p.projected.hh.horizontal_break,
          p.projected.hh.horizontal_break_se,
        ),
      },
    },
    measuredHh:
      p.measured_hh === null
        ? null
        : {
            ivb: p.measured_hh.ivb,
            horizontalBreak: p.measured_hh.horizontal_break,
            n: p.measured_hh.n,
          },
  })),
})

export const loadProjections = async (): Promise<Projections> => {
  const raw = projectionsSchema.parse(
    JSON.parse(await readFile(projectionsPath(), 'utf8')) as unknown,
  )
  return {
    densities: raw.densities,
    factors: raw.factors,
    pitchers: new Map(Object.entries(raw.pitchers).map(([k, v]) => [k, toPitcher(k, v)])),
  }
}

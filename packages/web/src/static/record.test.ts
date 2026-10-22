import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  HANDS,
  PITCH_TYPES,
  baselinePitches,
  buildRequest,
  labArsenal,
  leagueMedian,
} from '@/domain/simulator'
import { asPercent, exampleRows, translatorRequests } from '@/domain/translator'
import { precomputedKey } from '@/sources/apiClient'
import { loadPitchEffectiveness } from '@/sources/locationSource'
import { loadProjections } from '@/sources/projectionSource'
import { loadSimulatorDataset } from '@/sources/simulatorSource'

vi.mock('server-only', () => ({}))

/**
 * Not a test: the recorder of the static site (`docs/17`). Runs only with
 * SUPERESTELA_RECORD=1 and an API answering at SUPERESTELA_API_URL.
 *
 * It builds the very requests the screens send when they open — every real
 * pitch of every pitcher in the Simulator, the laboratory's starting pitches,
 * the Translator's example — with the screens' own functions, so the bodies
 * match byte for byte, and saves each answer under `precomputedKey`, where
 * `apiFetch` looks for it in the static build.
 */
const API = process.env.SUPERESTELA_API_URL ?? 'http://localhost:8000'
const OUT = path.join(process.cwd(), 'public', 'precomputed')
// The same example the Translator page opens on (app/traductor/page.tsx).
const TRANSLATOR_EXAMPLE = 'pitcher_00069/2025'

type Recording = {
  readonly path: string
  readonly body: string
  readonly answer: () => Promise<string | null>
}

/**
 * The API's answer, or null when it rejects the request (422): a few real
 * pitches fall outside its ranges, and the live screen says so too. Nothing is
 * saved for them; the static screen then explains it cannot recompute.
 */
const post = (route: string, body: string) => async (): Promise<string | null> => {
  const response = await fetch(`${API}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  const text = await response.text()
  if (response.status === 422) return null
  if (!response.ok) throw new Error(`${route} ${String(response.status)}: ${text.slice(0, 200)}`)
  return text
}

/** Runs the answers a few at a time: the API has two workers, not a thousand. */
const inBatches = async (jobs: readonly Recording[], size: number): Promise<number> => {
  let rejected = 0
  for (let i = 0; i < jobs.length; i += size) {
    await Promise.all(
      jobs.slice(i, i + size).map(async (job) => {
        const answer = await job.answer()
        if (answer === null) {
          rejected += 1
          return
        }
        await writeFile(path.join(OUT, `${precomputedKey(job.path, job.body)}.json`), answer)
      }),
    )
  }
  return rejected
}

describe.runIf(process.env.SUPERESTELA_RECORD === '1')('static site recorder', () => {
  it(
    'records every answer the screens ask for when they open',
    { timeout: 3_600_000 },
    async () => {
      const [{ distributions, arsenals }, projections, effectiveness] = await Promise.all([
        loadSimulatorDataset(),
        loadProjections(),
        loadPitchEffectiveness(),
      ])
      const jobs: Recording[] = []
      const simulate = (request: unknown): void => {
        const body = JSON.stringify(request)
        jobs.push({ path: '/api/simulate', body, answer: post('/api/v1/simulate', body) })
      }

      // Simulator, from a pitcher: each real pitch, untouched (Simulator.tsx, baselineOf).
      for (const a of arsenals) {
        for (const pitch of baselinePitches(a.sea)) {
          simulate(buildRequest(pitch, pitch.pitchType, a.hand, a.sea, a.pitcherId))
        }
      }
      // Simulator, laboratory: the league median against the league's fastball.
      const fastball = leagueMedian(distributions, 'Four-Seam')
      const reference = {
        releaseSpeed: fastball.releaseSpeed,
        ivb: fastball.ivb,
        horizontalBreak: fastball.horizontalBreak,
      }
      for (const hand of HANDS) {
        for (const pt of PITCH_TYPES) {
          simulate(
            buildRequest(
              leagueMedian(distributions, pt),
              pt,
              hand,
              labArsenal(distributions, reference),
              null,
            ),
          )
        }
      }
      // Translator: its example, one request per pitch (useTranslation).
      const example = arsenals.find((a) => a.key === TRANSLATOR_EXAMPLE)
      expect(example).toBeDefined()
      if (example !== undefined) {
        const rows = asPercent(exampleRows(example))
        for (const request of translatorRequests(rows, example.hand, projections.densities.sea)) {
          simulate(request)
        }
      }
      // The pitcher's own most and least effective pitches: data, no API.
      for (const [key, maps] of effectiveness ?? []) {
        jobs.push({
          path: `/api/pitch-effectiveness?${new URLSearchParams({ key }).toString()}`,
          body: '',
          answer: () => Promise.resolve(JSON.stringify(maps)),
        })
      }

      await mkdir(OUT, { recursive: true })
      const rejected = await inBatches(jobs, 8)
      console.log(
        `Recorded ${String(jobs.length - rejected)} answers in ${OUT}; the API rejected ${String(rejected)}`,
      )
      expect(jobs.length).toBeGreaterThan(arsenals.length)
    },
  )
})

'use client'

import { useId, useState } from 'react'
import { formatNumber } from '@/domain/format'
import type { FileProblem } from '@/domain/translator'
import {
  arsenalSummarySchema,
  fileProblemSchema,
  type ArsenalSummary,
} from '@/sources/arsenalSummary'
import { es } from '@/i18n/es'

/** El mismo tope que la API (`MAX_ARSENAL_FILE_CHARS`): mas grande no se manda. */
export const MAX_FILE_BYTES = 10_000_000

type Upload =
  | { readonly status: 'idle' }
  | { readonly status: 'reading' }
  | { readonly status: 'loaded'; readonly name: string; readonly summary: ArsenalSummary }
  | {
      readonly status: 'error'
      readonly problem: FileProblem | 'tooLarge' | 'unreachable'
      readonly columns: readonly string[]
    }

/** `FileReader` y no `File.text()`: funciona igual en cualquier navegador y en jsdom. */
export const readText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('unreadable'))
    }
    reader.readAsText(file)
  })

const ask = async (csv: string): Promise<Upload & { readonly status: 'loaded' | 'error' }> => {
  const response = await fetch('/api/arsenals/summarize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ csv }),
  })
  const body: unknown = await response.json()
  if (response.ok) return { status: 'loaded', name: '', summary: arsenalSummarySchema.parse(body) }
  const problem = fileProblemSchema.safeParse(body)
  return problem.success
    ? { status: 'error', problem: problem.data.error, columns: problem.data.columns }
    : { status: 'error', problem: 'unreachable', columns: [] }
}

/**
 * La entrada principal del Traductor: el export de TrackMan de un lanzador que
 * no esta en nuestros datos. El archivo se resume en la API, que es la unica
 * que conoce los nombres del proveedor; aqui solo se lee, se manda y se cuenta
 * lo que la API dejo fuera, para que nada se descarte en silencio.
 */
export const FileUpload = ({ onLoad }: { readonly onLoad: (summary: ArsenalSummary) => void }) => {
  const id = useId()
  const [upload, setUpload] = useState<Upload>({ status: 'idle' })

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    if (file.size > MAX_FILE_BYTES) {
      setUpload({ status: 'error', problem: 'tooLarge', columns: [] })
      return
    }
    setUpload({ status: 'reading' })
    try {
      const result = await ask(await readText(file))
      if (result.status === 'loaded') {
        setUpload({ ...result, name: file.name })
        onLoad(result.summary)
      } else {
        setUpload(result)
      }
    } catch (error: unknown) {
      console.error(error)
      setUpload({ status: 'error', problem: 'unreachable', columns: [] })
    }
  }

  const copy = es.translator.upload
  return (
    <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
      <label htmlFor={id} className="text-[15px] font-bold">
        {copy.label}
      </label>
      <input
        id={id}
        type="file"
        accept=".csv,text/csv"
        className="text-[13px]"
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
        }}
      />
      <p className="text-[12px] text-(--color-text-muted)">{copy.hint}</p>
      <div role="status" className="flex flex-col gap-1 text-[13px]">
        {upload.status === 'reading' ? (
          <p className="text-(--color-text-muted)">{copy.reading}</p>
        ) : null}
        {upload.status === 'error' ? (
          <p className="font-semibold text-(--color-semantic-trap)">
            {copy.problems[upload.problem]}
            {upload.columns.length > 0 ? ` ${upload.columns.join(', ')}.` : null}
          </p>
        ) : null}
        {upload.status === 'loaded' ? <Loaded name={upload.name} summary={upload.summary} /> : null}
      </div>
      <p className="text-[12px] text-(--color-text-muted)">{copy.manual}</p>
    </section>
  )
}

const Loaded = ({ name, summary }: { readonly name: string; readonly summary: ArsenalSummary }) => {
  const copy = es.translator.upload
  const used = summary.pitches.reduce((s, p) => s + p.n, 0)
  const hasLeftovers = summary.unsupportedRows > 0 || summary.missingFeatureRows > 0
  return (
    <>
      <p>{copy.loaded(name, formatNumber(used, 0), String(summary.pitches.length))}</p>
      {hasLeftovers ? (
        <p className="text-(--color-text-muted)">
          {copy.left(
            formatNumber(summary.unsupportedRows, 0),
            formatNumber(summary.missingFeatureRows, 0),
          )}
        </p>
      ) : null}
      {summary.unsupportedTypes.length > 0 ? (
        <p className="text-(--color-text-muted)">
          {copy.unsupportedTypes(summary.unsupportedTypes.join(', '))}
        </p>
      ) : null}
      {summary.omittedTypes.length > 0 ? (
        <p className="text-(--color-text-muted)">
          {copy.omittedTypes(summary.omittedTypes.join(', '))}
        </p>
      ) : null}
      {summary.isMeasuredAtExtreme ? <p>{copy.extreme}</p> : null}
    </>
  )
}

'use client'

import { useState } from 'react'
import { es } from '@/i18n/es'

/**
 * A file input with Spanish chrome. The native one prints the browser's own
 * «Choose File / No file chosen», in English; this keeps the real input (for
 * the keyboard, screen readers and the tests' label) but visually hidden, and
 * draws a button and the chosen file's name.
 */
export const FilePicker = ({
  id,
  onFile,
}: {
  /** The input's id: the section's heading label points at it. */
  readonly id: string
  readonly onFile: (file: File | undefined) => void
}) => {
  const [name, setName] = useState<string | null>(null)
  const copy = es.translator.upload
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <input
        id={id}
        type="file"
        accept=".csv,text/csv"
        className="peer sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          setName(file?.name ?? null)
          onFile(file)
        }}
      />
      <label
        htmlFor={id}
        className="cursor-pointer border border-(--color-border-strong) bg-(--color-surface-card) px-3 py-1.5 font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-(--color-ink) hover:bg-(--color-surface-page)"
      >
        {copy.choose}
      </label>
      <span className="text-(--color-text-muted)">{name ?? copy.noFile}</span>
    </div>
  )
}

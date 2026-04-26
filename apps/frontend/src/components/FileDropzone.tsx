'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  onFiles: (files: File[]) => void
  accept?: string[]
  maxSizeMB?: number
  multiple?: boolean
  className?: string
}

const DEFAULT_ACCEPT = ['application/pdf', 'text/plain', 'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

export default function FileDropzone({
  onFiles,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 10,
  multiple = true,
  className,
}: Props) {
  const [rejected, setRejected] = useState<string[]>([])

  const onDrop = useCallback((accepted: File[], rejected_: { file: File; errors: readonly { message: string }[] }[]) => {
    setRejected(rejected_.map(r => `${r.file.name}: ${r.errors[0]?.message}`))
    if (accepted.length) onFiles(accepted)
  }, [onFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.reduce((acc, t) => ({ ...acc, [t]: [] }), {}),
    maxSize: maxSizeMB * 1024 * 1024,
    multiple,
  })

  return (
    <div className={cn('space-y-2', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragActive
            ? 'border-primary bg-accent/50'
            : 'border-border hover:border-primary/50 hover:bg-accent/30'
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud size={32} className="mb-3 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm font-medium text-foreground">Отпустите файл здесь</p>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">Перетащите файл или нажмите для выбора</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, DOCX, TXT, MD, PNG, JPG, XLSX · до {maxSizeMB} МБ
            </p>
          </>
        )}
      </div>
      {rejected.map((msg, i) => (
        <p key={i} className="flex items-center gap-1 text-xs text-destructive">
          <X size={12} />
          {msg}
        </p>
      ))}
    </div>
  )
}

export function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <FileText size={12} />
      {file.name}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={12} />
      </button>
    </span>
  )
}

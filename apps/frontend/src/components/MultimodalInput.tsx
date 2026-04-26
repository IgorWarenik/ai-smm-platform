'use client'
import { useCallback, useRef, useState } from 'react'
import { Paperclip, Mic, Link2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { FileChip } from './FileDropzone'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit?: (payload: { text: string; attachments: File[]; urls: string[] }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function MultimodalInput({
  value, onChange, onSubmit, placeholder, disabled, className,
}: Props) {
  const [attachments, setAttachments] = useState<File[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [showUrlField, setShowUrlField] = useState(false)
  const [urls, setUrls] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoGrow = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`
  }

  const removeAttachment = (i: number) =>
    setAttachments(prev => prev.filter((_, idx) => idx !== i))

  const addUrl = () => {
    const trimmed = urlInput.trim()
    if (trimmed && !urls.includes(trimmed)) {
      setUrls(prev => [...prev, trimmed])
    }
    setUrlInput('')
    setShowUrlField(false)
  }

  const onDrop = useCallback((files: File[]) => {
    setAttachments(prev => [...prev, ...files])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    multiple: true,
    accept: {
      'application/pdf': [], 'text/plain': [], 'text/markdown': [],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
      'image/png': [], 'image/jpeg': [],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
    },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring/30 transition-all', isDragActive && 'ring-2 ring-primary/50', className)}>
      <div {...getRootProps()} className="relative">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {attachments.map((f, i) => (
              <FileChip key={i} file={f} onRemove={() => removeAttachment(i)} />
            ))}
          </div>
        )}
        {urls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2">
            {urls.map((u, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Link2 size={10} />
                <span className="max-w-[160px] truncate">{u}</span>
                <button type="button" onClick={() => setUrls(prev => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-foreground">×</button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { onChange(e.target.value); autoGrow() }}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
              e.preventDefault()
              onSubmit({ text: value, attachments, urls })
            }
          }}
          placeholder={placeholder ?? 'Опишите задачу подробно — платформу, цель, аудиторию...'}
          disabled={disabled}
          rows={4}
          className="w-full resize-none rounded-t-lg bg-transparent px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
          style={{ minHeight: 120 }}
        />
        {isDragActive && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 text-sm font-medium text-primary">
            Отпустите файл
          </div>
        )}
      </div>

      {showUrlField && (
        <div className="flex gap-2 px-3 pb-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addUrl()}
            placeholder="https://..."
            autoFocus
            className="flex-1 rounded-md border border-input bg-muted px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="button" onClick={addUrl} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
            Добавить
          </button>
          <button type="button" onClick={() => setShowUrlField(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Отмена
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.xlsx"
          onChange={e => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) setAttachments(prev => [...prev, ...files])
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Прикрепить файл"
        >
          <Paperclip size={14} />
          <span>Файл</span>
        </button>
        <button
          type="button"
          onClick={() => setShowUrlField(v => !v)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Добавить URL"
        >
          <Link2 size={14} />
          <span>URL</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
          title="Голосовой ввод — скоро"
          disabled
        >
          <Mic size={14} />
          <span>Голос</span>
        </button>
        {onSubmit && (
          <span className="ml-auto text-[10px] text-muted-foreground">⌘↵ отправить</span>
        )}
      </div>
    </div>
  )
}

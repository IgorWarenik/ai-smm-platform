'use client'
import { useEffect, useRef, useState } from 'react'
import { apiFetch, apiUpload } from '@/lib/api'
import { useProject } from '@/contexts/project'
import AppShell from '@/components/layout/AppShell'
import FileDropzone from '@/components/FileDropzone'
import { Trash2, Edit2, Check, X as XIcon, Search, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type KItem = { id: string; category: string; content: string; hasEmbedding?: boolean; metadata?: { title?: string; sourceFile?: string; description?: string } }
type KSearchResult = KItem & { similarity?: number }
type Tab = 'text' | 'upload'

const CATEGORIES = ['FRAMEWORK', 'CASE', 'TEMPLATE', 'SEO', 'PLATFORM_SPEC', 'BRAND_GUIDE']
const QUERY_STOP_WORDS = new Set(['и', 'или', 'в', 'во', 'на', 'по', 'с', 'со', 'к', 'ко', 'о', 'об', 'от', 'до', 'для', 'из', 'у', 'а', 'но'])

function getQueryTerms(query: string): string[] {
  return Array.from(new Set(
    query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map(term => term.trim())
      .filter(term => term.length > 1 && !QUERY_STOP_WORDS.has(term))
  ))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getRelevantSnippet(content: string, terms: string[], maxLength = 420) {
  const normalized = content.toLowerCase()
  const firstHit = terms
    .map(term => normalized.indexOf(term.toLowerCase()))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0]

  const center = firstHit ?? 0
  const start = Math.max(0, center - Math.floor(maxLength / 3))
  const end = Math.min(content.length, start + maxLength)

  return {
    text: content.slice(start, end).trim(),
    hasExactHit: firstHit !== undefined,
    hasPrefix: start > 0,
    hasSuffix: end < content.length,
  }
}

function HighlightedSnippet({ content, query }: { content: string; query: string }) {
  const terms = getQueryTerms(query)
  const snippet = getRelevantSnippet(content, terms)

  if (!terms.length || !snippet.hasExactHit) {
    return (
      <span className="rounded bg-primary/10 px-1 py-0.5 text-foreground">
        {snippet.hasPrefix ? '...' : ''}{snippet.text}{snippet.hasSuffix ? '...' : ''}
      </span>
    )
  }

  const matcher = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  const parts = snippet.text.split(matcher)

  return (
    <span className="text-foreground">
      {snippet.hasPrefix ? '...' : ''}
      {parts.map((part, index) => (
        terms.includes(part.toLowerCase()) ? (
          <mark key={index} className="rounded bg-amber-200 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      ))}
      {snippet.hasSuffix ? '...' : ''}
    </span>
  )
}

function KnowledgePageInner() {
  const { activeProject } = useProject()
  const [items, setItems] = useState<KItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('text')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KSearchResult[] | null>(null)
  const [searchNotReady, setSearchNotReady] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  // Text form
  const [category, setCategory] = useState('BRAND_GUIDE')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [adding, setAdding] = useState(false)

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // File upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch_ = () => {
    if (!activeProject) return
    const pageSize = 100
    const loadPage = (page: number): Promise<{ data: KItem[]; total: number }> =>
      apiFetch<{ data: KItem[]; total: number }>(`/api/projects/${activeProject.id}/knowledge?page=${page}&pageSize=${pageSize}`)

    loadPage(1)
      .then(async (firstPage) => {
        const allItems = [...firstPage.data]
        const totalPages = Math.ceil(firstPage.total / pageSize)

        for (let page = 2; page <= totalPages; page++) {
          const nextPage = await loadPage(page)
          allItems.push(...nextPage.data)
        }

        setItems(allItems)
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }

  // Poll every 3s while any item is missing embedding
  useEffect(() => {
    const hasPending = items.some(i => i.hasEmbedding === false)
    if (hasPending) {
      if (!pollRef.current) {
        pollRef.current = setInterval(fetch_, 3000)
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [items, activeProject?.id])

  useEffect(() => { fetch_() }, [activeProject?.id])

  const handleSearch = async () => {
    if (!query.trim() || !activeProject) { setResults(null); setSearchNotReady(false); return }
    setSearching(true)
    try {
      const res = await apiFetch<any>(`/api/projects/${activeProject.id}/knowledge/search?q=${encodeURIComponent(query)}`)
      setSearchNotReady(!!res.notReady)
      setResults(res.notReady ? null : res.data)
    } finally { setSearching(false) }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    setAdding(true)
    setError('')
    try {
      await apiFetch(`/api/projects/${activeProject.id}/knowledge`, {
        method: 'POST',
        body: JSON.stringify({ category, content, metadata: { title } }),
      })
      setContent('')
      setTitle('')
      fetch_()
    } catch (err: any) { setError(err.message ?? 'Ошибка') }
    finally { setAdding(false) }
  }

  const handleDelete = async (id: string) => {
    if (!activeProject || !confirm('Удалить?')) return
    try {
      await apiFetch(`/api/projects/${activeProject.id}/knowledge/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err: any) { setError(err.message) }
  }

  const handleDeleteFile = async (sourceFile: string, fileItems: KItem[]) => {
    if (!activeProject) return
    if (!confirm(`Удалить файл «${sourceFile}» и все его фрагменты (${fileItems.length} шт.)?`)) return
    try {
      for (const item of fileItems) {
        await apiFetch(`/api/projects/${activeProject.id}/knowledge/${item.id}`, { method: 'DELETE' })
      }
      fetch_()
    } catch (err: any) { setError(err.message) }
  }

  const handleEdit = async (id: string) => {
    if (!activeProject || !editContent.trim()) return
    try {
      const { data } = await apiFetch<{ data: KItem }>(`/api/projects/${activeProject.id}/knowledge/${id}`, {
        method: 'PATCH', body: JSON.stringify({ content: editContent }),
      })
      setItems(prev => prev.map(i => i.id === id ? data : i))
      setEditingId(null)
    } catch (err: any) { setError(err.message) }
  }

  const handleUpload = async () => {
    if (!activeProject || !uploadFiles.length) return
    setUploading(true)
    setUploadStatus('uploading')
    try {
      for (const file of uploadFiles) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('description', uploadDescription)
        await apiUpload(`/api/projects/${activeProject.id}/knowledge/upload`, fd)
      }
      setUploadFiles([])
      setUploadDescription('')
      setUploadStatus('done')
      fetch_()
      setTimeout(() => setUploadStatus('idle'), 3000)
    } catch {
      setUploadStatus('error')
    } finally { setUploading(false) }
  }

  if (!activeProject) {
    return <div className="py-10 text-center text-sm text-muted-foreground"><a href="/dashboard" className="hover:underline">Выберите проект</a></div>
  }

  const fileGroups = items
    .filter(i => i.metadata?.sourceFile)
    .reduce<Record<string, KItem[]>>((acc, i) => {
      const key = i.metadata!.sourceFile!
      acc[key] = [...(acc[key] ?? []), i]
      return acc
    }, {})

  const textItems = items.filter(i => !i.metadata?.sourceFile)

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-medium text-foreground">База знаний</h1>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Семантический поиск..."
            className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {searching ? 'Поиск...' : 'Найти'}
        </button>
        {results && (
          <button onClick={() => setResults(null)} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Сбросить
          </button>
        )}
      </div>

      {searchNotReady && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Файлы ещё обрабатываются — семантический поиск станет доступен после завершения индексации.
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Результаты поиска ({results.length})</p>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ничего не найдено</p>
          ) : results.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">{r.category}</span>
                {typeof r.similarity === 'number' && (
                  <span className="text-xs text-muted-foreground">{Math.round(r.similarity * 100)}%</span>
                )}
              </div>
              <p className="leading-6">
                <HighlightedSnippet content={r.content} query={query} />
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: add form */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['text', 'upload'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  tab === t
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'text' ? 'Текст' : 'Загрузить файл'}
              </button>
            ))}
          </div>

          {tab === 'text' ? (
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Заголовок</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Категория</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Содержимое <span className="text-destructive">*</span></label>
                <textarea value={content} onChange={e => setContent(e.target.value)} required rows={6}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 min-h-[160px] resize-y" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={adding}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {adding ? 'Сохранение...' : 'Добавить в базу'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Описание содержимого файла</label>
                <textarea
                  value={uploadDescription}
                  onChange={e => setUploadDescription(e.target.value)}
                  rows={3}
                  placeholder="Например: описание продукта, глоссарий, материалы стратегической сессии..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 min-h-[88px] resize-y"
                />
              </div>
              <FileDropzone
                onFiles={files => setUploadFiles(prev => [...prev, ...files])}
              />
              {uploadFiles.length > 0 && (
                <div className="space-y-1">
                  {uploadFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5">
                      <span className="flex-1 truncate text-xs text-foreground">{f.name}</span>
                      <button onClick={() => setUploadFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground">
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {uploadStatus === 'done' && <p className="text-sm text-green-700">Файлы загружены и обрабатываются</p>}
              {uploadStatus === 'error' && <p className="text-sm text-destructive">Ошибка загрузки. Проверьте формат файла (PDF, DOCX, MD, TXT).</p>}
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFiles.length}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? 'Загрузка...' : `Загрузить ${uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}`}
              </button>
            </div>
          )}
        </div>

        {/* Right: items list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Все материалы</h2>
            <span className="text-xs text-muted-foreground">{items.length} шт.</span>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">База знаний пуста</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {Object.entries(fileGroups).map(([sourceFile, fileItems]) => {
                const allReady = fileItems.every(i => i.hasEmbedding)
                const readyCount = fileItems.filter(i => i.hasEmbedding).length
                return (
                  <div key={sourceFile} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <FileText size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {sourceFile}
                          </span>
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {fileItems[0]?.category}
                        </span>
                          <button
                            onClick={() => handleDeleteFile(sourceFile, fileItems)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={`Удалить файл ${sourceFile}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                          {fileItems.length} фрагментов
                        </span>
                          {allReady ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                              <Check size={12} />
                              Готов к поиску
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Loader2 size={12} className="animate-spin" />
                              Обработка {readyCount}/{fileItems.length}
                            </span>
                        )}
                      </div>
                      {fileItems[0]?.metadata?.description && (
                        <p className="text-xs text-muted-foreground leading-5">
                          {fileItems[0].metadata.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
              {textItems.map(item => (
                <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {item.category}
                    </span>
                    {item.metadata?.title && (
                      <span className="text-xs font-medium text-foreground">{item.metadata.title}</span>
                    )}
                  </div>
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={4}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 min-h-[100px]"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(item.id)}
                          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                          <Check size={12} /> Сохранить
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <XIcon size={12} /> Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="line-clamp-3 text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => { setEditingId(item.id); setEditContent(item.content) }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 size={12} /> Изменить
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={12} /> Удалить
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function KnowledgePage() {
  return (
    <AppShell>
      <KnowledgePageInner />
    </AppShell>
  )
}

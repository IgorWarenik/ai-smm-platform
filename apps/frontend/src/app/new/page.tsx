'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'
import AppShell from '@/components/layout/AppShell'
import MultimodalInput from '@/components/MultimodalInput'
import TaskQualityScore from '@/components/TaskQualityScore'
import PlatformChip from '@/components/PlatformChip'
import { cn } from '@/lib/utils'

const TASK_TYPES = [
  { group: 'Контент', items: ['Авто-определение', 'Пост', 'Карусель', 'Истории', 'Reels-сценарий', 'TikTok-сценарий', 'Контент-план', 'Промпт для изображения'] },
  { group: 'Стратегия', items: ['SMM-стратегия', 'Анализ ЦА', 'Анализ конкурентов', 'Медиаплан'] },
  { group: 'Кампания', items: ['SMM-кампания запуск'] },
]
const ALL_TYPES = TASK_TYPES.flatMap(g => g.items)
const CONTENT_TYPES = new Set(['Пост', 'Карусель', 'Истории', 'Reels-сценарий', 'TikTok-сценарий', 'Контент-план', 'Промпт для изображения'])
const PLATFORMS = ['Instagram', 'TikTok', 'Telegram', 'VK', 'YouTube', 'LinkedIn', 'X', 'Pinterest']
const PRIORITIES = ['Срочно', 'Стандарт', 'Низкий']

const TYPE_TO_SEARCH: Record<string, string> = {
  'post': 'Пост',
  'content-plan': 'Контент-план',
  'reels': 'Reels-сценарий',
  'carousel': 'Карусель',
  'stories': 'Истории',
  'image-prompt': 'Промпт для изображения',
}

function NewRequestPageInner() {
  const { activeProject } = useProject()
  const router = useRouter()
  const searchParams = useSearchParams()

  const typeParam = searchParams.get('type')
  const initialType = typeParam ? (TYPE_TO_SEARCH[typeParam] ?? 'Авто-определение') : 'Авто-определение'

  const [text, setText] = useState('')
  const [taskType, setTaskType] = useState(initialType)
  const [platforms, setPlatforms] = useState<string[]>([])
  const [priority, setPriority] = useState('Стандарт')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const showPlatforms = CONTENT_TYPES.has(taskType)
  const showScore = text.trim().split(/\s+/).filter(Boolean).length >= 3

  const togglePlatform = (p: string) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const handleSubmit = async (payload: { text: string; attachments: File[]; urls: string[] }) => {
    if (!activeProject) { setError('Выберите проект на дашборде'); return }
    if (!payload.text.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const combinedText = [
        payload.text,
        payload.urls.length ? `\nСсылки: ${payload.urls.join(', ')}` : '',
      ].join('')
      const res: any = await apiFetch(`/api/projects/${activeProject.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          input: combinedText,
          metadata: { type: taskType, platforms, priority },
        }),
      })
      if (res.clarificationQuestions) {
        router.push(`/tasks?selected=${res.data.id}&clarify=1`)
      } else {
        router.push(`/tasks?selected=${res.data.id}`)
      }
    } catch (err: any) {
      setError(err?.code === 'TASK_SCORE_TOO_LOW'
        ? 'Задача слишком расплывчата. Добавьте контекст, платформу и цель.'
        : err?.message ?? 'Ошибка создания задачи')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-[22px] font-medium text-foreground">Что нужно сделать?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Опишите задачу — агент выполнит её на уровне Senior SMM-специалиста
        </p>
      </div>

      {!activeProject && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Проект не выбран.{' '}
          <a href="/dashboard" className="font-medium underline">Выберите на дашборде</a>
        </div>
      )}

      {/* Task type chips */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Тип задачи</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTaskType(t)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                taskType === t
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Platforms */}
      {showPlatforms && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Платформы</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map(p => (
              <PlatformChip
                key={p}
                platform={p}
                selected={platforms.includes(p)}
                onClick={() => togglePlatform(p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Priority */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Приоритет</p>
        <div className="flex gap-1.5">
          {PRIORITIES.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                priority === p
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <MultimodalInput
        value={text}
        onChange={setText}
        onSubmit={handleSubmit}
        disabled={submitting}
        placeholder="Опишите задачу подробно — платформу, цель, аудиторию, тон, объём..."
      />

      {/* Quality score */}
      <TaskQualityScore text={text} visible={showScore} />

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleSubmit({ text, attachments: [], urls: [] })}
          disabled={submitting || !text.trim() || !activeProject}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? 'Отправка...' : 'Отправить агентам'}
        </button>
        <button
          type="button"
          disabled
          className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed"
        >
          Сохранить как черновик
        </button>
      </div>
    </div>
  )
}

export default function NewPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="py-8 text-sm text-muted-foreground">Загрузка...</div>}>
        <NewRequestPageInner />
      </Suspense>
    </AppShell>
  )
}

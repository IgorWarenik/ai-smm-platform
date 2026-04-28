'use client'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'
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

interface Props {
  initialType?: string
  onSuccess: (taskId: string, clarify: boolean) => void
  onCancel?: () => void
}

export default function NewTaskForm({ initialType = 'Авто-определение', onSuccess, onCancel }: Props) {
  const { activeProject } = useProject()

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
      onSuccess(res.data.id, !!res.clarificationQuestions)
    } catch (err: any) {
      setError(
        err?.code === 'PROFILE_MISSING'
          ? 'Перед отправкой заполните профиль проекта: компания, описание, ниша и география.'
          : err?.code === 'TASK_SCORE_TOO_LOW'
            ? 'Задача слишком расплывчата. Добавьте контекст, платформу и цель.'
            : err?.message ?? 'Ошибка создания задачи'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-foreground">Что нужно сделать?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Опишите задачу — агент выполнит её на уровне Senior SMM-специалиста
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-1 shrink-0 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕ Закрыть
          </button>
        )}
      </div>

      {!activeProject && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Проект не выбран.{' '}
          <a href="/dashboard" className="font-medium underline">Выберите на дашборде</a>
        </div>
      )}

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

      <MultimodalInput
        value={text}
        onChange={setText}
        onSubmit={handleSubmit}
        disabled={submitting}
        placeholder="Опишите задачу подробно — платформу, цель, аудиторию, тон, объём..."
      />

      <TaskQualityScore text={text} visible={showScore} />

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleSubmit({ text, attachments: [], urls: [] })}
          disabled={submitting || !text.trim() || !activeProject}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? 'Отправка...' : 'Отправить агентам'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}

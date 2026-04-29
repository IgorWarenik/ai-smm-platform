'use client'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'
import { useLang } from '@/contexts/lang'
import type { TranslationKey } from '@/lib/i18n'
import MultimodalInput from '@/components/MultimodalInput'
import TaskQualityScore from '@/components/TaskQualityScore'
import PlatformChip from '@/components/PlatformChip'
import AgentScenarioFlow, { estimateScenario } from '@/components/AgentScenarioFlow'
import { cn } from '@/lib/utils'

const TASK_TYPES = [
  { group: 'Контент', groupKey: 'newTask.group.content' as TranslationKey, items: [
    { value: 'Авто-определение', key: 'newTask.type.auto' as TranslationKey },
    { value: 'Пост', key: 'newTask.type.post' as TranslationKey },
    { value: 'Карусель', key: 'newTask.type.carousel' as TranslationKey },
    { value: 'Истории', key: 'newTask.type.stories' as TranslationKey },
    { value: 'Reels-сценарий', key: 'newTask.type.reels' as TranslationKey },
    { value: 'TikTok-сценарий', key: 'newTask.type.tiktok' as TranslationKey },
    { value: 'Контент-план', key: 'newTask.type.contentPlan' as TranslationKey },
    { value: 'Промпт для изображения', key: 'newTask.type.imagePrompt' as TranslationKey },
  ]},
  { group: 'Стратегия', groupKey: 'newTask.group.strategy' as TranslationKey, items: [
    { value: 'SMM-стратегия', key: 'newTask.type.smmStrategy' as TranslationKey },
    { value: 'Анализ ЦА', key: 'newTask.type.audienceAnalysis' as TranslationKey },
    { value: 'Анализ конкурентов', key: 'newTask.type.competitorAnalysis' as TranslationKey },
    { value: 'Медиаплан', key: 'newTask.type.mediaPlan' as TranslationKey },
  ]},
  { group: 'Кампания', groupKey: 'newTask.group.campaign' as TranslationKey, items: [
    { value: 'SMM-кампания запуск', key: 'newTask.type.campaignLaunch' as TranslationKey },
  ]},
]

const ALL_TYPE_ITEMS = TASK_TYPES.flatMap(g => g.items)
const CONTENT_VALUES = new Set(['Пост', 'Карусель', 'Истории', 'Reels-сценарий', 'TikTok-сценарий', 'Контент-план', 'Промпт для изображения'])
const PLATFORMS = ['Instagram', 'TikTok', 'Telegram', 'VK', 'YouTube', 'LinkedIn', 'X', 'Pinterest']

const PRIORITY_ITEMS = [
  { value: 'Срочно', key: 'newTask.priority.urgent' as TranslationKey },
  { value: 'Стандарт', key: 'newTask.priority.standard' as TranslationKey },
  { value: 'Низкий', key: 'newTask.priority.low' as TranslationKey },
]

interface Props {
  initialType?: string
  onSuccess: (taskId: string, clarify: boolean) => void
  onCancel?: () => void
}

export default function NewTaskForm({ initialType = 'Авто-определение', onSuccess, onCancel }: Props) {
  const { activeProject } = useProject()
  const { t } = useLang()

  const [text, setText] = useState('')
  const [taskType, setTaskType] = useState(initialType)
  const [platforms, setPlatforms] = useState<string[]>([])
  const [priority, setPriority] = useState('Стандарт')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const showPlatforms = CONTENT_VALUES.has(taskType)
  const showScore = text.trim().split(/\s+/).filter(Boolean).length >= 3
  const previewScenario = estimateScenario(taskType, text)

  const togglePlatform = (p: string) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const handleSubmit = async (payload: { text: string; attachments: File[]; urls: string[] }) => {
    if (!activeProject) { setError(t('newTask.errorNoProject')); return }
    if (!payload.text.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const combinedText = [
        payload.text,
        payload.urls.length ? `\n${t('newTask.linksLabel')}: ${payload.urls.join(', ')}` : '',
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
          ? t('newTask.errorProfileMissing')
          : err?.code === 'TASK_SCORE_TOO_LOW'
            ? t('newTask.errorTooVague')
            : err?.message ?? t('common.error')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-foreground">{t('newTask.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('newTask.subtitle')}</p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-1 shrink-0 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('common.close')}
          </button>
        )}
      </div>

      {!activeProject && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('common.noProject')}{' '}
          <a href="/dashboard" className="font-medium underline">{t('common.selectOnDashboard')}</a>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('newTask.taskType')}</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPE_ITEMS.map(({ value, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTaskType(value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                taskType === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      {showPlatforms && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('newTask.platforms')}</p>
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
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('newTask.priority')}</p>
        <div className="flex gap-1.5">
          {PRIORITY_ITEMS.map(({ value, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPriority(value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                priority === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      <AgentScenarioFlow
        scenario={previewScenario}
        title={t('newTask.route')}
      />

      <MultimodalInput
        value={text}
        onChange={setText}
        onSubmit={handleSubmit}
        disabled={submitting}
        placeholder={t('newTask.placeholder')}
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
          {submitting ? t('newTask.submitting') : t('newTask.submit')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}

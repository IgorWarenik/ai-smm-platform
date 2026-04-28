'use client'

import { useEffect, useState } from 'react'
import AgentAvatar from '@/components/AgentAvatar'
import AppShell from '@/components/layout/AppShell'
import StatusBadge from '@/components/StatusBadge'
import { useProject } from '@/contexts/project'
import { apiFetch } from '@/lib/api'
import { ArrowRight, Copy } from 'lucide-react'

type AgentOutput = {
  agentType: 'MARKETER' | 'CONTENT_MAKER' | 'EVALUATOR'
  output: string
}

type Execution = {
  agentOutputs?: AgentOutput[]
}

type Task = {
  id: string
  input: string
  status: string
  createdAt: string
  updatedAt: string
  executions?: Execution[]
}

function ArtifactCard({
  task,
  copied,
  onCopy,
}: {
  task: Task
  copied: boolean
  onCopy: (output: string) => void
}) {
  const primaryOutput = task.executions?.[0]?.agentOutputs?.[0]
  const outputPreview = primaryOutput?.output?.slice(0, 120) ?? ''
  const hasOverflow = Boolean(primaryOutput?.output && primaryOutput.output.length > 120)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {primaryOutput?.agentType ? (
            <AgentAvatar type={primaryOutput.agentType} size={28} />
          ) : (
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-medium text-muted-foreground">
              AI
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {primaryOutput?.agentType ?? 'ARTIFACT'}
            </p>
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <p className="line-clamp-2 text-sm font-medium leading-6 text-foreground">{task.input}</p>

      <div className="mt-3 min-h-[88px] rounded-lg border border-border bg-background p-3">
        {primaryOutput?.output ? (
          <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">
            {outputPreview}
            {hasOverflow ? '…' : ''}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Вывод агента пока не сохранён.</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {new Date(task.updatedAt || task.createdAt).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => primaryOutput?.output && onCopy(primaryOutput.output)}
            disabled={!primaryOutput?.output}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5">
              <Copy size={14} />
              {copied ? 'Скопировано' : 'Копировать'}
            </span>
          </button>
          <a
            href={`/tasks?selected=${task.id}`}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <span className="inline-flex items-center gap-1.5">
              <ArrowRight size={14} />
            </span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const { activeProject } = useProject()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeProject) {
      setTasks([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    apiFetch<{ data: Task[] }>(
      `/api/projects/${activeProject.id}/tasks?pageSize=50&status=COMPLETED`
    )
      .then(async ({ data }) => {
        const detailedTasks = await Promise.all(
          data.map(async (task) => {
            const detail = await apiFetch<{ data: Task }>(`/api/projects/${activeProject.id}/tasks/${task.id}`)
            return detail.data
          })
        )

        if (!cancelled) setTasks(detailedTasks)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Не удалось загрузить библиотеку')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeProject?.id])

  const handleCopy = async (taskId: string, output: string) => {
    try {
      await navigator.clipboard.writeText(output)
      setCopiedTaskId(taskId)
      setTimeout(() => setCopiedTaskId((current) => (current === taskId ? null : current)), 2000)
    } catch {
      setError('Не удалось скопировать текст')
    }
  }

  if (!activeProject) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-foreground">Библиотека контента</p>
          <p className="mt-1 text-xs text-muted-foreground">Проект не выбран</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-[22px] font-medium text-foreground">Библиотека</h1>
          <p className="text-sm text-muted-foreground">Готовые артефакты и завершённые задачи проекта</p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Загрузка библиотеки...
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Пока нет завершённых задач для библиотеки.</p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <ArtifactCard
                key={task.id}
                task={task}
                copied={copiedTaskId === task.id}
                onCopy={(output) => handleCopy(task.id, output)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

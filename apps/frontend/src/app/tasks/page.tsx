'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'
import { useTaskStream } from '@/hooks/useTaskStream'
import AppShell from '@/components/layout/AppShell'
import StatusBadge from '@/components/StatusBadge'
import AgentAvatar from '@/components/AgentAvatar'
import ApprovalPanel from '@/components/ApprovalPanel'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Task = {
  id: string
  input: string
  status: string
  scenario?: string
  clarificationNote?: string
  createdAt: string
  executions?: any[]
}

const STATUSES = ['ALL', 'RUNNING', 'AWAITING_APPROVAL', 'AWAITING_CLARIFICATION', 'COMPLETED', 'FAILED']

function mergeTask(existing: Task | undefined, incoming: Task): Task {
  if (!existing) return incoming
  const keepOutputs = existing.executions?.some((e: any) => e.agentOutputs?.length) &&
    !incoming.executions?.some((e: any) => e.agentOutputs?.length)
  return {
    ...existing,
    ...incoming,
    executions: keepOutputs ? existing.executions : incoming.executions ?? existing.executions,
  }
}

function TaskDetail({ task, projectId, onRefresh }: { task: Task; projectId: string; onRefresh: () => void }) {
  const [answer, setAnswer] = useState('')
  const [clarifying, setClarifying] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editVal, setEditVal] = useState(task.input)
  const [saving, setSaving] = useState(false)
  const streamEnabled = task.status === 'RUNNING'
  const streamEvents = useTaskStream(projectId, task.id, streamEnabled)

  const submitClarify = async (e: React.FormEvent) => {
    e.preventDefault()
    setClarifying(true)
    try {
      await apiFetch(`/api/projects/${projectId}/tasks/${task.id}/clarify`, {
        method: 'POST', body: JSON.stringify({ answer }),
      })
      setAnswer('')
      onRefresh()
    } finally { setClarifying(false) }
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await apiFetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH', body: JSON.stringify({ input: editVal }),
      })
      setEditMode(false)
      onRefresh()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <StatusBadge status={task.status} />
          <span className="text-xs text-muted-foreground">
            {new Date(task.createdAt).toLocaleDateString('ru-RU')}
          </span>
        </div>

        {editMode ? (
          <div className="space-y-2">
            <textarea
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30 min-h-[120px] resize-y"
            />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => setEditMode(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="group relative">
            <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{task.input}</p>
            {(task.status === 'PENDING' || task.status === 'REJECTED') && (
              <button
                onClick={() => { setEditVal(task.input); setEditMode(true) }}
                className="absolute right-0 top-0 hidden rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground group-hover:block hover:text-foreground"
              >
                Изменить
              </button>
            )}
          </div>
        )}
      </div>

      {/* Clarification needed */}
      {task.status === 'AWAITING_CLARIFICATION' && (
        <form onSubmit={submitClarify} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Агенту нужно уточнение</p>
          {task.clarificationNote && (
            <ul className="list-inside list-disc space-y-1 text-sm text-amber-700">
              {task.clarificationNote.split('\n').filter(Boolean).map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          )}
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            required
            rows={3}
            placeholder="Ваш ответ..."
            className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300/50 min-h-[80px]"
          />
          <button type="submit" disabled={clarifying}
            className="rounded-md bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            {clarifying ? 'Отправка...' : 'Ответить'}
          </button>
        </form>
      )}

      {/* Live stream */}
      {task.status === 'RUNNING' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-sm font-medium text-foreground">Агент работает</p>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {streamEvents.map((ev, i) => (
              <div key={i} className="rounded-md border-l-2 border-blue-200 bg-blue-50/50 py-2 pl-3 pr-2 text-sm">
                {ev.agentType && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <AgentAvatar type={ev.agentType as any} size={20} />
                    <span className="text-xs font-medium text-muted-foreground">{ev.agentType}</span>
                  </div>
                )}
                {ev.content && <p className="text-foreground">{ev.content}</p>}
                {ev.error && <p className="text-destructive">{ev.error}</p>}
              </div>
            ))}
            {streamEvents.length === 0 && (
              <p className="text-xs text-muted-foreground">Ожидание вывода агента...</p>
            )}
          </div>
        </div>
      )}

      {/* Approval */}
      {task.status === 'AWAITING_APPROVAL' && (
        <ApprovalPanel
          projectId={projectId}
          taskId={task.id}
          agentOutputs={task.executions?.[0]?.agentOutputs?.map((o: any) => ({
            agentType: o.agentType, content: o.output,
          })) ?? []}
          onDecision={onRefresh}
        />
      )}

      {/* Completed outputs */}
      {task.status === 'COMPLETED' && task.executions?.[0]?.agentOutputs?.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Результат</p>
          {task.executions?.[0].agentOutputs.map((o: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <AgentAvatar type={o.agentType} size={20} />
                <span className="text-xs font-medium text-muted-foreground">{o.agentType}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{o.output}</div>
            </div>
          ))}
        </div>
      )}

      {/* Failed */}
      {task.status === 'FAILED' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Задача завершилась с ошибкой.
        </div>
      )}
    </div>
  )
}

function TasksPageInner() {
  const { activeProject } = useProject()
  const searchParams = useSearchParams()
  const initialSelected = searchParams.get('selected')

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected)

  const selectedTask = tasks.find(t => t.id === selectedId)

  const fetchTasks = () => {
    if (!activeProject) return
    const qs = statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''
    apiFetch<{ data: Task[] }>(`/api/projects/${activeProject.id}/tasks?pageSize=30${qs}`)
      .then(({ data }) => {
        setTasks(prev => data.map(t => mergeTask(prev.find(p => p.id === t.id), t)))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTasks() }, [activeProject?.id, statusFilter])

  useEffect(() => {
    if (!tasks.some(t => ['QUEUED', 'PENDING', 'RUNNING'].includes(t.status))) return
    const id = setInterval(fetchTasks, 2000)
    return () => clearInterval(id)
  }, [activeProject?.id, statusFilter, tasks])

  useEffect(() => {
    if (!selectedId || !activeProject) return
    apiFetch<{ data: Task }>(`/api/projects/${activeProject.id}/tasks/${selectedId}`)
      .then(({ data }) => {
        setTasks(prev => prev.some(t => t.id === data.id)
          ? prev.map(t => t.id === data.id ? mergeTask(t, data) : t)
          : [data, ...prev])
      })
      .catch(() => { })
  }, [activeProject?.id, selectedId])

  const handleDelete = async (tid: string) => {
    if (!activeProject || !confirm('Удалить задачу?')) return
    await apiFetch(`/api/projects/${activeProject.id}/tasks/${tid}`, { method: 'DELETE' })
    setSelectedId(prev => prev === tid ? null : prev)
    fetchTasks()
  }

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground">Проект не выбран.</p>
        <a href="/dashboard" className="mt-2 text-sm font-medium text-foreground hover:underline">Выбрать проект</a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-medium text-foreground">Задачи</h1>
        <a
          href="/new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          + Новая задача
        </a>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {s === 'ALL' ? 'Все' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* Task list */}
        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
          {!loading && tasks.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Нет задач</p>
            </div>
          )}
          {tasks.map(t => (
            <div key={t.id} className="group relative">
              <button
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  'w-full rounded-lg border p-3.5 text-left transition-colors',
                  selectedId === t.id
                    ? 'border-primary/50 bg-accent/40'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-accent/20'
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-foreground">{t.input}</p>
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
                className="absolute right-2.5 top-2.5 hidden h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:border-destructive/40 hover:text-destructive group-hover:flex transition-colors"
                title="Удалить"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Task detail */}
        <div>
          {selectedTask ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <TaskDetail
                task={selectedTask}
                projectId={activeProject.id}
                onRefresh={fetchTasks}
              />
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Выберите задачу для просмотра</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="py-8 text-sm text-muted-foreground">Загрузка...</div>}>
        <TasksPageInner />
      </Suspense>
    </AppShell>
  )
}

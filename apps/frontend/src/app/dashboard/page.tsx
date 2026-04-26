'use client'
export const dynamic = 'force-dynamic'
import { useAuth } from '@/contexts/auth'
import { useProject } from '@/contexts/project'
import { apiFetch } from '@/lib/api'
import AppShell from '@/components/layout/AppShell'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PlusCircle, Folder, ArrowRight } from 'lucide-react'

type Project = {
  id: string
  name: string
  description?: string
  _count?: { tasks: number }
}

type Task = {
  id: string
  input: string
  status: string
  createdAt: string
}

type TaskCounts = {
  awaitingApproval: number
  awaitingClarification: number
  running: number
  completedThisMonth: number
}

const QUICK_SCENARIOS = [
  { type: 'post', label: 'Новый пост' },
  { type: 'content-plan', label: 'Контент-план' },
  { type: 'reels', label: 'Reels-сценарий' },
  { type: 'carousel', label: 'Карусель' },
  { type: 'stories', label: 'Серия историй' },
  { type: 'image-prompt', label: 'Промпт для изображения' },
]

function ProjectSelector() {
  const { setActiveProject } = useProject()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: Project[] }>('/api/projects')
      .then(({ data }) => setProjects(data))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const select = (p: Project) => {
    setActiveProject({ id: p.id, name: p.name, description: p.description })
    router.refresh()
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-foreground">Выберите проект</h1>
          <p className="mt-1 text-sm text-muted-foreground">Кликните на проект для работы</p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <PlusCircle size={16} />
          Новый проект
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <Folder size={40} className="mb-3 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Нет проектов</p>
          <p className="mt-1 text-sm text-muted-foreground">Создайте первый маркетинговый проект</p>
          <Link
            href="/projects/new"
            className="mt-4 flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <PlusCircle size={14} />
            Создать проект
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => select(p)}
              className="group flex flex-col items-start rounded-lg border border-border bg-card p-5 text-left hover:border-primary/40 hover:bg-accent/30 transition-colors"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <p className="font-medium text-foreground">{p.name}</p>
                <ArrowRight size={16} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {p.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              )}
              {p._count !== undefined && (
                <span className="mt-3 text-xs text-muted-foreground">
                  {p._count.tasks} задач
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SMMLDashboard() {
  const { user } = useAuth()
  const { activeProject, clearActiveProject } = useProject()
  const [tasks, setTasks] = useState<Task[]>([])
  const [counts, setCounts] = useState<TaskCounts>({ awaitingApproval: 0, awaitingClarification: 0, running: 0, completedThisMonth: 0 })
  const [loading, setLoading] = useState(true)

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    if (!activeProject) return
    const id = activeProject.id

    Promise.all([
      apiFetch<{ data: Task[] }>(`/api/projects/${id}/tasks?pageSize=20`),
    ])
      .then(([tasksRes]) => {
        const all = tasksRes.data
        setTasks(all)
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        setCounts({
          awaitingApproval: all.filter(t => t.status === 'AWAITING_APPROVAL').length,
          awaitingClarification: all.filter(t => t.status === 'AWAITING_CLARIFICATION').length,
          running: all.filter(t => t.status === 'RUNNING' || t.status === 'QUEUED').length,
          completedThisMonth: all.filter(t => t.status === 'COMPLETED' && new Date(t.createdAt) >= startOfMonth).length,
        })
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [activeProject?.id])

  const actionableTasks = tasks.filter(t =>
    ['AWAITING_APPROVAL', 'AWAITING_CLARIFICATION', 'REVISION_REQUESTED'].includes(t.status)
  ).slice(0, 5)

  const inWorkTasks = tasks.filter(t => ['RUNNING', 'QUEUED'].includes(t.status)).slice(0, 3)

  const next7Days = tasks.filter(t => {
    if (t.status !== 'PENDING' && t.status !== 'QUEUED') return false
    const created = new Date(t.createdAt)
    const diff = (new Date().getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 7
  }).slice(0, 10)

  const STAT_CARDS = [
    { label: 'На согласовании', value: counts.awaitingApproval, href: '/tasks?status=AWAITING_APPROVAL', color: '#EDE9FE', fg: '#5B21B6' },
    { label: 'Ждёт уточнений', value: counts.awaitingClarification, href: '/tasks?status=AWAITING_CLARIFICATION', color: '#FEF3C7', fg: '#92400E' },
    { label: 'В работе', value: counts.running, href: '/tasks?status=RUNNING', color: '#DBEAFE', fg: '#1E40AF' },
    { label: 'Готово в этом месяце', value: counts.completedThisMonth, href: '/tasks?status=COMPLETED', color: '#D1FAE5', fg: '#065F46' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
          <h1 className="mt-0.5 text-[22px] font-medium text-foreground">
            Привет, {user?.name?.split(' ')[0] ?? 'пользователь'}
          </h1>
          <button
            onClick={clearActiveProject}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            {activeProject?.name} — сменить проект
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STAT_CARDS.map(c => (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 hover:bg-accent/20 transition-colors"
            >
              <p className="text-2xl font-semibold" style={{ color: c.fg }}>{c.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Actionable tasks */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-foreground">Требуют вашего ответа</h2>
            {actionableTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">Нет задач, ждущих вашего решения</p>
              </div>
            ) : (
              <div className="space-y-2">
                {actionableTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                    <StatusBadge status={t.status} />
                    <p className="flex-1 truncate text-sm text-foreground">{t.input}</p>
                    <Link
                      href={`/tasks?selected=${t.id}`}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Открыть
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* In work */}
          {inWorkTasks.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-foreground">Сейчас в работе</h2>
              <div className="space-y-2">
                {inWorkTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    <p className="flex-1 truncate text-sm text-foreground">{t.input}</p>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick scenarios */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-foreground">Быстрые сценарии</h2>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_SCENARIOS.map(s => (
                <Link
                  key={s.type}
                  href={`/new?type=${s.type}`}
                  className="rounded-md border border-border bg-card px-3 py-2.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-accent/30 transition-colors text-center"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Next 7 days */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-foreground">Следующие 7 дней</h2>
            {next7Days.length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет запланированных постов</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {next7Days.map(t => (
                  <Link
                    key={t.id}
                    href={`/tasks?selected=${t.id}`}
                    className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t.input.slice(0, 24)}…
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { activeProject } = useProject()
  return (
    <AppShell>
      {activeProject ? <SMMLDashboard /> : <ProjectSelector />}
    </AppShell>
  )
}

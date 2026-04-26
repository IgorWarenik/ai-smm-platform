'use client'

import { useEffect, useMemo, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import StatusBadge from '@/components/StatusBadge'
import { useProject } from '@/contexts/project'
import { apiFetch } from '@/lib/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Task = {
  id: string
  input: string
  status: string
  createdAt: string
  updatedAt: string
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function toDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isSameDay(left: Date | null, right: Date) {
  return Boolean(left) && toDayKey(left as Date) === toDayKey(right)
}

function buildCalendarDays(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (firstOfMonth.getDay() + 6) % 7
  const firstCell = new Date(firstOfMonth)
  firstCell.setDate(firstCell.getDate() - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell)
    day.setDate(firstCell.getDate() + index)
    return day
  })
}

function CalendarGrid({
  month,
  selectedDay,
  countsByDay,
  onSelectDay,
}: {
  month: Date
  selectedDay: Date | null
  countsByDay: Map<string, number>
  onSelectDay: (day: Date) => void
}) {
  const days = buildCalendarDays(month)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="px-2 py-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {weekday}
          </div>
        ))}

        {days.map((day) => {
          const key = toDayKey(day)
          const count = countsByDay.get(key) ?? 0
          const inMonth = day.getMonth() === month.getMonth()

          return (
            <button
              key={key}
              onClick={() => onSelectDay(day)}
              className={[
                'min-h-[96px] rounded-lg border p-2 text-left transition-colors',
                isSameDay(selectedDay, day)
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background hover:border-primary/30 hover:bg-accent/20',
                !inMonth ? 'opacity-55' : '',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={inMonth ? 'text-sm font-medium text-foreground' : 'text-sm font-medium text-muted-foreground'}>
                  {day.getDate()}
                </span>
                {count > 0 && (
                  <div className="text-right">
                    <div className="text-xs font-medium text-primary">{count}</div>
                    <div className="mx-auto mt-0.5 h-1 w-1 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const { activeProject } = useProject()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeProject) {
      setTasks([])
      setSelectedDay(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    apiFetch<{ data: Task[] }>(
      `/api/projects/${activeProject.id}/tasks?pageSize=100&status=COMPLETED`
    )
      .then(({ data }) => {
        if (!cancelled) setTasks(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Не удалось загрузить календарь')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeProject?.id])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const sourceDate = new Date(task.updatedAt || task.createdAt)
      const key = toDayKey(sourceDate)
      const existing = map.get(key) ?? []
      existing.push(task)
      map.set(key, existing)
    }

    for (const [, dayTasks] of map) {
      dayTasks.sort((left, right) => {
        return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      })
    }

    return map
  }, [tasks])

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const [key, dayTasks] of tasksByDay.entries()) {
      map.set(key, dayTasks.length)
    }
    return map
  }, [tasksByDay])

  const selectedTasks = selectedDay ? tasksByDay.get(toDayKey(selectedDay)) ?? [] : []
  const monthLabel = month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  if (!activeProject) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-foreground">Календарь публикаций</p>
          <p className="mt-1 text-xs text-muted-foreground">Проект не выбран</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-medium text-foreground">Календарь</h1>
            <p className="text-sm text-muted-foreground">Завершённые задачи по дате готовности</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <ChevronLeft size={14} />
                Предыдущий
              </span>
            </button>
            <div className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium capitalize text-foreground">
              {monthLabel}
            </div>
            <button
              onClick={() => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                Следующий
                <ChevronRight size={14} />
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                Загрузка календаря...
              </div>
            ) : (
              <CalendarGrid
                month={month}
                selectedDay={selectedDay}
                countsByDay={countsByDay}
                onSelectDay={setSelectedDay}
              />
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-foreground">
              {selectedDay
                ? `Задачи за ${selectedDay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Задачи за день'}
            </h2>

            {!selectedDay && (
              <p className="mt-3 text-sm text-muted-foreground">Выберите день в календаре, чтобы увидеть завершённые задачи.</p>
            )}

            {selectedDay && selectedTasks.length === 0 && (
              <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                В этот день завершённых задач не было.
              </div>
            )}

            {selectedTasks.length > 0 && (
              <div className="mt-3 space-y-3">
                {selectedTasks.map((task) => (
                  <a
                    key={task.id}
                    href={`/tasks?selected=${task.id}`}
                    className="block rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/30 hover:bg-accent/20"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <StatusBadge status={task.status} />
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(task.updatedAt || task.createdAt).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="line-clamp-3 text-sm text-foreground">{task.input}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

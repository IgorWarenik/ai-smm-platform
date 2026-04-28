'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  ListTodo,
  Calendar,
  Library,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  BookOpen,
} from 'lucide-react'
import TierProgress from './TierProgress'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'

const NAV = [
  { icon: LayoutDashboard, label: 'Главная', href: '/dashboard' },
  { icon: ListTodo, label: 'Задачи', href: '/tasks' },
  { icon: Calendar, label: 'Календарь', href: '/calendar' },
  { icon: Library, label: 'Библиотека', href: '/library' },
  { icon: Building2, label: 'Проект', href: '/project' },
  { icon: BookOpen, label: 'База знаний', href: '/project/knowledge' },
  { icon: Settings, label: 'Настройки', href: '/settings' },
]

const STORAGE_KEY = 'sidebar_collapsed'

type Project = {
  id: string
  name: string
}

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const { activeProject, setActiveProject, clearActiveProject } = useProject()

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch { }
  }, [])

  useEffect(() => {
    let cancelled = false

    apiFetch<{ data: Project[] }>('/api/projects')
      .then(({ data }) => {
        if (cancelled) return
        setProjects(data)

        if (activeProject && !data.some((project) => project.id === activeProject.id)) {
          clearActiveProject()
        }
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })

    return () => {
      cancelled = true
    }
  }, [activeProject?.id, clearActiveProject])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  return (
    <aside
      className={cn(
        'panel-surface relative z-10 flex min-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-[28px] transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-border/80',
        collapsed ? 'h-[68px] justify-center px-0' : 'h-[68px] gap-3 px-5'
      )}>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shrink-0 shadow-sm">
          AI
        </div>
        {!collapsed && (
          <div>
            <span className="block text-sm font-semibold text-foreground">AI Marketing</span>
            <span className="block text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Studio OS</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map(({ icon: Icon, label, href }) => {
          const active = href === '/dashboard' || href === '/project'
            ? pathname === href
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                collapsed && 'justify-center'
              )}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}

        <div className={cn('mt-4 border-t border-border/70 pt-4', collapsed && 'px-0')}>
          {collapsed ? (
            <Link
              href="/dashboard"
              title="Проекты"
              className="flex justify-center rounded-2xl px-2 py-2.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
            >
              <FolderOpen size={20} />
            </Link>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Проекты
                </span>
                <Link
                  href="/dashboard"
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Все
                </Link>
              </div>

              <div className="space-y-1">
                {projects.length === 0 ? (
                  <Link
                    href="/dashboard"
                    className="block rounded-2xl px-3 py-2.5 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
                  >
                    Выбрать проект
                  </Link>
                ) : (
                  projects.slice(0, 6).map((project) => {
                    const isActive = activeProject?.id === project.id
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => setActiveProject(project)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                        )}
                        title={project.name}
                      >
                        <FolderOpen size={15} className="shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Tier progress */}
      <div className="border-t border-border">
        <TierProgress collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className={cn(
          'flex items-center border-t border-border px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors',
          collapsed ? 'justify-center' : 'gap-2'
        )}
      >
        {collapsed ? <ChevronRight size={16} /> : (
          <>
            <ChevronLeft size={16} />
            <span className="text-xs">Свернуть</span>
          </>
        )}
      </button>
    </aside>
  )
}

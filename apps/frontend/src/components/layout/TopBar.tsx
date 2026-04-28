'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Moon, Sun, LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Главная',
  new: 'Новый запрос',
  tasks: 'Задачи',
  calendar: 'Календарь',
  library: 'Библиотека',
  project: 'Проект',
  knowledge: 'База знаний',
  settings: 'Настройки',
}

function Breadcrumbs() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)

  if (parts.length === 0) return null

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1
        const label = ROUTE_LABELS[part] ?? part
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-border" />}
            <span className={cn(isLast ? 'text-foreground font-medium' : '')}>{label}</span>
          </span>
        )
      })}
    </nav>
  )
}

export default function TopBar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (!stored && prefersDark)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
    // Sync to cookie so server can render correct theme on next load
    if (!document.cookie.includes('theme=')) {
      document.cookie = `theme=${isDark ? 'dark' : 'light'}; path=/; max-age=31536000; SameSite=Lax`
    }
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    const val = next ? 'dark' : 'light'
    localStorage.setItem('theme', val)
    document.cookie = `theme=${val}; path=/; max-age=31536000; SameSite=Lax`
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="panel-surface flex h-[68px] shrink-0 items-center gap-4 rounded-[24px] px-5">
      <div className="flex-1 min-w-0">
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={dark ? 'Светлая тема' : 'Тёмная тема'}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="panel-surface absolute right-0 top-12 z-20 min-w-[200px] rounded-2xl py-1">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-xs font-medium text-foreground truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent/50 transition-colors"
                >
                  <LogOut size={14} />
                  Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  PlusCircle,
  ListTodo,
  Calendar,
  Library,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import TierProgress from './TierProgress'
import { cn } from '@/lib/utils'

const NAV = [
  { icon: LayoutDashboard, label: 'Главная', href: '/dashboard' },
  { icon: PlusCircle, label: 'Новый запрос', href: '/new' },
  { icon: ListTodo, label: 'Задачи', href: '/tasks' },
  { icon: Calendar, label: 'Календарь', href: '/calendar' },
  { icon: Library, label: 'Библиотека', href: '/library' },
  { icon: Building2, label: 'Проект', href: '/project' },
  { icon: Settings, label: 'Настройки', href: '/settings' },
]

const STORAGE_KEY = 'sidebar_collapsed'

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch { }
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-card transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-border',
        collapsed ? 'h-[52px] justify-center px-0' : 'h-[52px] gap-2 px-4'
      )}>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold shrink-0">
          AI
        </div>
        {!collapsed && (
          <span className="text-sm font-medium text-foreground">AI Marketing</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {NAV.map(({ icon: Icon, label, href }) => {
          const active = href === '/dashboard'
            ? pathname === href
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                collapsed && 'justify-center'
              )}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Tier progress */}
      <div className="border-t border-border">
        <TierProgress collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className={cn(
          'flex items-center border-t border-border px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors',
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

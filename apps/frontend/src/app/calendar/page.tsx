'use client'
import AppShell from '@/components/layout/AppShell'
import { Calendar } from 'lucide-react'

export default function CalendarPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Calendar size={40} className="mb-3 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Календарь публикаций</p>
        <p className="mt-1 text-xs text-muted-foreground">Реализуется в Wave 16-FE</p>
      </div>
    </AppShell>
  )
}

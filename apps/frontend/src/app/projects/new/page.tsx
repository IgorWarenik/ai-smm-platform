'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'

export default function NewProjectPage() {
  const router = useRouter()
  const { setActiveProject } = useProject()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await apiFetch<{ data: { id: string; name: string; description?: string } }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined }),
      })
      setActiveProject({ id: data.id, name: data.name, description: data.description })
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Ошибка создания проекта')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Назад
          </Link>
          <h1 className="mt-3 text-[22px] font-medium text-foreground">Новый проект</h1>
          <p className="mt-1 text-sm text-muted-foreground">Создайте рабочее пространство для маркетинга</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Название <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              placeholder="Название проекта"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Краткое описание проекта"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 transition-all resize-none"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Создание...' : 'Создать проект'}
            </button>
            <Link
              href="/dashboard"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Отмена
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

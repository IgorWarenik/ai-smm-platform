'use client'
import { useAuth } from '@/contexts/auth'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Project = {
  id: string
  name: string
  description?: string
  _count?: { tasks: number }
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: Project[] }>('/api/projects')
      .then(({ data }) => setProjects(data))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="space-page">
      <div className="space-container-wide">
        <div className="space-nav mb-10 !mx-0 !w-full">
          <div>
            <p className="eyebrow">Mission Control</p>
            <h1 className="text-2xl font-bold">Projects</h1>
            {user && <p className="muted-text text-sm">{user.email}</p>}
          </div>
          <div className="ml-auto flex gap-3">
            <Link href="/projects/new" className="btn-primary">
              New Project
            </Link>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-panel animate-pulse p-5">
                <div className="mb-3 h-5 w-3/4 rounded bg-white/15" />
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="mt-2 h-3 w-2/3 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <p className="section-title">No projects yet</p>
            <p className="muted-text mt-2">Create your first AI marketing workspace.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="glass-panel block p-5 hover:border-indigo-300/50">
                <p className="eyebrow mb-2">Campaign Node</p>
                <h2 className="text-xl font-bold text-white">{p.name}</h2>
                {p.description && (
                  <p className="muted-text mt-2 line-clamp-2 text-sm">{p.description}</p>
                )}
                {p._count !== undefined && (
                  <p className="status-pill mt-5">{p._count.tasks} task{p._count.tasks !== 1 ? 's' : ''}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

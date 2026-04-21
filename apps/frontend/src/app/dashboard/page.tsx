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
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          {user && <p className="text-sm text-gray-500">{user.email}</p>}
        </div>
        <div className="flex gap-3">
          <Link href="/projects/new"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
            New Project
          </Link>
          <button onClick={handleLogout}
            className="border px-4 py-2 rounded text-sm font-medium hover:bg-gray-50">
            Logout
          </button>
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse border rounded-lg p-4 bg-white">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mt-1" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <p className="text-gray-500">No projects yet. Create your first one.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}
              className="block border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
              <h2 className="font-semibold text-lg">{p.name}</h2>
              {p.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
              )}
              {p._count !== undefined && (
                <p className="text-xs text-gray-400 mt-2">{p._count.tasks} task{p._count.tasks !== 1 ? 's' : ''}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

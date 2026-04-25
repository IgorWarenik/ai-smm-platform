'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await apiFetch<{ data: { id: string } }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined }),
      })
      router.push(`/projects/${data.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-page">
      <div className="space-container">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="muted-text text-sm hover:text-white">← Dashboard</Link>
            <h1 className="page-title mt-2">New Project</h1>
          </div>
        </div>
        <div className="glass-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Project Name <span className="text-rose-300">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="field"
                placeholder="My Marketing Campaign" />
            </div>
            <div>
              <label className="field-label">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className="field"
                placeholder="What is this project about?" />
            </div>
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Creating...' : 'Create Project'}
              </button>
              <Link href="/dashboard" className="btn-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

type Project = { id: string; name: string; description?: string }
type Member = { userId: string; role: string; user: { email: string; name?: string } }

export default function ProjectSettingsPage() {
    const { id: projectId } = useParams() as { id: string }
    const router = useRouter()

    const [project, setProject] = useState<Project | null>(null)
    const [members, setMembers] = useState<Member[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('MEMBER')
    const [inviting, setInviting] = useState(false)
    const [inviteError, setInviteError] = useState('')

    const [deleteConfirm, setDeleteConfirm] = useState('')
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        // Load project details
        apiFetch<{ data: Project }>(`/api/projects/${projectId}`)
            .then(({ data }) => {
                setProject(data)
                setName(data.name)
                setDescription(data.description ?? '')
            })
            .catch((err) => setError(err.message ?? 'Load failed'))
            .finally(() => setLoading(false))

        // Load members with Task 3 fallback
        apiFetch<{ data: Member[] }>(`/api/projects/${projectId}/members`)
            .then(({ data }) => setMembers(data))
            .catch(() => setMembers([]))
    }, [projectId])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')
        try {
            const { data } = await apiFetch<{ data: Project }>(`/api/projects/${projectId}`, {
                method: 'PATCH',
                body: JSON.stringify({ name, description: description || undefined }),
            })
            setProject(data)
            setSuccess('Settings saved.')
        } catch (err: any) { setError(err.message ?? 'Save failed') }
        finally { setSaving(false) }
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setInviting(true)
        setInviteError('')
        try {
            await apiFetch(`/api/projects/${projectId}/members`, {
                method: 'POST',
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            })
            setInviteEmail('')
            const { data } = await apiFetch<{ data: Member[] }>(`/api/projects/${projectId}/members`)
            setMembers(data)
        } catch (err: any) { setInviteError(err.message ?? 'Invite failed') }
        finally { setInviting(false) }
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Remove this member?')) return
        try {
            await apiFetch(`/api/projects/${projectId}/members/${memberId}`, { method: 'DELETE' })
            setMembers(prev => prev.filter(m => m.userId !== memberId))
        } catch (err: any) { setError(err.message ?? 'Remove failed') }
    }

    const handleDeleteProject = async () => {
        if (deleteConfirm !== project?.name) return
        setDeleting(true)
        try {
            await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' })
            router.push('/dashboard')
        } catch (err: any) {
            setError(err.message ?? 'Delete failed')
            setDeleting(false)
        }
    }

    if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
    if (!project) return null

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h2 className="text-xl font-semibold mb-4">Project Settings</h2>
                <form onSubmit={handleSave} className="bg-white border rounded-lg p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Project Name <span className="text-red-500">*</span></label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required
                            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {success && <p className="text-sm text-green-600">{success}</p>}
                    <button type="submit" disabled={saving}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            </div>

            <div className="border border-red-200 rounded-lg p-6 space-y-3">
                <h3 className="text-lg font-semibold text-red-700">Danger Zone</h3>
                <p className="text-sm text-gray-600">Type <strong>{project.name}</strong> to confirm deletion. This cannot be undone.</p>
                <div className="flex gap-2">
                    <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                        placeholder={project.name}
                        className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                    <button
                        onClick={handleDeleteProject}
                        disabled={deleting || deleteConfirm !== project.name}
                        className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                        {deleting ? 'Deleting...' : 'Delete Project'}
                    </button>
                </div>
            </div>
        </div>
    )
}
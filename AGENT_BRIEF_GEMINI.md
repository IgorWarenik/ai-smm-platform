# Agent Brief — Gemini
## Wave 6 | Branch: `agent/frontend-v3`

**Stack:** Next.js 14 + App Router + TypeScript + Tailwind CSS.

**Rules:**
- New branch from main: `git checkout -b agent/frontend-v3`
- Work ONLY in `apps/frontend/src/` — no other directories
- Do NOT run npm install or npx — just write TypeScript/TSX files
- Do NOT merge — Claude reviews
- On finish: write report to `AGENTS_CHAT.md` under `## Wave 6 → Gemini`
- Validation: `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors

---

## What already exists (DO NOT rewrite)

```
apps/frontend/src/
  app/
    layout.tsx, page.tsx, globals.css
    login/page.tsx, register/page.tsx, dashboard/page.tsx
    projects/new/page.tsx
    projects/[id]/
      page.tsx        ← tasks + ClarificationForm + status filter
      layout.tsx      ← nav: Tasks | Profile | Knowledge | ← Dashboard
      profile/page.tsx
      knowledge/page.tsx  ← edit + delete per item
      error.tsx, loading.tsx
  lib/api.ts, contexts/auth.tsx, middleware.ts
  components/ApprovalPanel.tsx, hooks/useTaskStream.ts
```

---

## Task 1 — Project settings page `/projects/[id]/settings/page.tsx`

Create `apps/frontend/src/app/projects/[id]/settings/page.tsx`:

```tsx
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
    Promise.all([
      apiFetch<{ data: Project }>(`/api/projects/${projectId}`),
      apiFetch<{ data: Member[] }>(`/api/projects/${projectId}/members`),
    ]).then(([p, m]) => {
      setProject(p.data)
      setName(p.data.name)
      setDescription(p.data.description ?? '')
      setMembers(m.data)
    }).catch(() => {}).finally(() => setLoading(false))
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

      <div>
        <h3 className="text-lg font-semibold mb-3">Members</h3>
        <div className="bg-white border rounded-lg divide-y mb-4">
          {members.map(m => (
            <div key={m.userId} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-gray-500">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-500 uppercase">{m.role}</span>
                {m.role !== 'OWNER' && (
                  <button onClick={() => handleRemoveMember(m.userId)}
                    className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleInvite} className="bg-white border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Invite Member</p>
          <div className="flex gap-2">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
              placeholder="email@example.com"
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className="border rounded px-2 py-2 text-sm">
              <option value="MEMBER">Member</option>
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button type="submit" disabled={inviting}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {inviting ? '...' : 'Invite'}
            </button>
          </div>
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
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
```

---

## Task 2 — Add Settings to project nav in `projects/[id]/layout.tsx`

In `apps/frontend/src/app/projects/[id]/layout.tsx`, add a Settings nav link.

Find the nav links section (currently has Tasks | Profile | Knowledge) and add Settings:

```tsx
<Link href={`/projects/${projectId}/settings`}
  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded hover:bg-gray-100">
  Settings
</Link>
```

Place it after the Knowledge link, before the Dashboard back-link.

---

## Task 3 — Members list endpoint check

The settings page calls `GET /api/projects/:projectId/members`. Check if this route exists in the current API.

If it does NOT exist, add a mock-safe fallback: in the `useEffect`, wrap the members fetch in a try/catch that silently sets `members` to `[]` on failure:

```tsx
apiFetch<{ data: Member[] }>(`/api/projects/${projectId}/members`)
  .then(({ data }) => setMembers(data))
  .catch(() => setMembers([]))
```

This ensures the page renders even if the members endpoint doesn't exist yet.

---

## Architecture context

```
API endpoints available:
  GET    /api/projects/:id          → 200 { data: Project }
  PATCH  /api/projects/:id          → 200 { data: Project }
  DELETE /api/projects/:id          → 204
  POST   /api/projects/:id/members  → 200 (add member by email)
  DELETE /api/projects/:id/members/:memberId → 204  (Wave 6 Codex, may not be merged yet)

GET /api/projects/:id/members — may not exist (check projects.ts before assuming)
If it doesn't exist, the settings page handles it gracefully (catch → empty array).

MemberRole values: OWNER | EDITOR | MEMBER | VIEWER
```

---

## How to submit

1. `git checkout -b agent/frontend-v3` from main
2. Create/modify files as specified above
3. `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors
4. Commit with descriptive message
5. Write report in `AGENTS_CHAT.md` under `## Wave 6 → Gemini`:
   - Files changed/created
   - tsc result
   - Whether GET /members existed or fallback was used
   - Any deviations
6. Tell the human "done, agent/frontend-v3 ready for review"

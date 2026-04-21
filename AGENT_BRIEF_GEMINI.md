# Agent Brief — Gemini
## Wave 5 | Branch: `agent/frontend-v2`

**Stack:** Next.js 14 + App Router + TypeScript + Tailwind CSS.

**Rules:**
- New branch from main: `git checkout -b agent/frontend-v2`
- Work ONLY in `apps/frontend/src/` — no other directories
- Do NOT run npm install or npx commands — just write TypeScript/TSX files
- Do NOT merge — Claude reviews
- On finish: write report to `AGENTS_CHAT.md` under `## Wave 5 → Gemini`
- Validation: `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors

---

## What already exists (DO NOT rewrite)

```
apps/frontend/src/
  app/
    layout.tsx, page.tsx, globals.css
    login/page.tsx, register/page.tsx, dashboard/page.tsx
    projects/new/page.tsx
    projects/[id]/page.tsx, layout.tsx, profile/page.tsx, knowledge/page.tsx
  lib/api.ts, contexts/auth.tsx, middleware.ts
  components/ApprovalPanel.tsx, hooks/useTaskStream.ts
```

---

## Task 1 — Knowledge edit/delete in `projects/[id]/knowledge/page.tsx`

New API: `DELETE /api/projects/:id/knowledge/:itemId` (→204), `PATCH` (→200 `{data: item}`).

Add to the existing page:

```tsx
type KnowledgeItem = { id: string; content: string; category: string; metadata?: Record<string, unknown> }

const [editingId, setEditingId] = useState<string | null>(null)
const [editContent, setEditContent] = useState('')

const handleDelete = async (itemId: string) => {
  if (!confirm('Delete this knowledge item?')) return
  try {
    await apiFetch(`/api/projects/${projectId}/knowledge/${itemId}`, { method: 'DELETE' })
    setItems(prev => prev.filter((i: KnowledgeItem) => i.id !== itemId))
  } catch (err: any) { setError(err.message ?? 'Delete failed') }
}

const handleEdit = async (itemId: string) => {
  if (!editContent.trim()) return
  try {
    const { data } = await apiFetch<{ data: KnowledgeItem }>(`/api/projects/${projectId}/knowledge/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: editContent }),
    })
    setItems(prev => prev.map((i: KnowledgeItem) => i.id === itemId ? data : i))
    setEditingId(null)
  } catch (err: any) { setError(err.message ?? 'Edit failed') }
}
```

In the item list JSX, replace static content display with inline edit/delete controls:

```tsx
{editingId === item.id ? (
  <div className="mt-2 space-y-2">
    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    <div className="flex gap-2">
      <button onClick={() => handleEdit(item.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Save</button>
      <button onClick={() => setEditingId(null)} className="text-xs border px-3 py-1 rounded hover:bg-gray-50">Cancel</button>
    </div>
  </div>
) : (
  <p className="text-sm mt-1 text-gray-700 line-clamp-3">{item.content}</p>
)}
<div className="flex gap-2 mt-1">
  <button onClick={() => { setEditingId(item.id); setEditContent(item.content) }}
    className="text-xs text-gray-500 hover:text-gray-700">Edit</button>
  <button onClick={() => handleDelete(item.id)}
    className="text-xs text-red-500 hover:text-red-700">Delete</button>
</div>
```

---

## Task 2 — Task status filter in `projects/[id]/page.tsx`

New API: `GET /api/projects/:id/tasks?status=PENDING` (etc.)

Add to the existing tasks page:

```tsx
const [statusFilter, setStatusFilter] = useState<string>('ALL')
```

Add filter buttons above the tasks list:
```tsx
<div className="flex flex-wrap gap-1 mb-3">
  {['ALL','PENDING','IN_PROGRESS','AWAITING_APPROVAL','APPROVED','REVISION_REQUESTED','COMPLETED','FAILED'].map(s => (
    <button key={s} onClick={() => setStatusFilter(s)}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50 border-gray-200'
      }`}>
      {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
    </button>
  ))}
</div>
```

Update the tasks `useEffect` to pass the filter:
```tsx
useEffect(() => {
  const qs = statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''
  apiFetch<{ data: Task[] }>(`/api/projects/${projectId}/tasks${qs}`)
    .then(({ data }) => setTasks(data))
    .catch(() => {})
}, [projectId, statusFilter])
```

---

## Task 3 — Error boundary + loading skeleton

Create `apps/frontend/src/app/projects/[id]/error.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="p-6 text-center">
      <h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-4">{error.message}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={reset} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">Try again</button>
        <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Back to Dashboard</Link>
      </div>
    </div>
  )
}
```

Create `apps/frontend/src/app/projects/[id]/loading.tsx`:
```tsx
export default function ProjectLoading() {
  return (
    <div className="p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
  )
}
```

---

## Task 4 — Dashboard loading skeleton

In `apps/frontend/src/app/dashboard/page.tsx`, replace:
```tsx
{loading ? (
  <p className="text-gray-500">Loading...</p>
) : ...}
```
With:
```tsx
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
```

---

## How to submit

1. `git checkout -b agent/frontend-v2` from main
2. Modify/create files as specified
3. `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors
4. Commit with descriptive message
5. Write report in `AGENTS_CHAT.md` under `## Wave 5 → Gemini`
6. Tell the human "done, agent/frontend-v2 ready for review"

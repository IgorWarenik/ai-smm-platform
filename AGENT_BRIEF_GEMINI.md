# Agent Brief — Gemini
## Wave 8 | Branch: `agent/frontend-v5`

**Stack:** Next.js 14 + App Router + TypeScript + Tailwind CSS.

**Rules:**
- New branch from main: `git checkout -b agent/frontend-v5`
- Work ONLY in `apps/frontend/src/` — no other directories
- Do NOT run npm install or npx — just write TypeScript/TSX files
- Do NOT merge — Claude reviews
- On finish: write report to `AGENTS_CHAT.md` under `## Wave 8 → Gemini`
- Validation: `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors

**IMPORTANT:** Files you create MUST go to the exact path specified. Do NOT put files in the repo root or any path other than `apps/frontend/src/...`.

---

## What already exists (DO NOT rewrite)

```
apps/frontend/src/
  app/
    projects/[id]/
      page.tsx          ← tasks page (creation, filter, stream, approval)
      layout.tsx        ← client component, active nav with usePathname
      profile/page.tsx
      knowledge/page.tsx
      settings/page.tsx
      error.tsx, loading.tsx
  lib/api.ts            ← apiFetch with auto-refresh
  contexts/auth.tsx
  middleware.ts
```

---

## Task 1 — Toast notification component

Create a reusable Toast component for success/error feedback.

**File:** `apps/frontend/src/components/Toast.tsx`

```tsx
'use client'
import { useEffect } from 'react'

type ToastProps = {
  message: string
  type: 'success' | 'error'
  onDismiss: () => void
}

export default function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  )
}
```

**Usage pattern** (for the other tasks below):
```tsx
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

// Show: setToast({ message: 'Task deleted', type: 'success' })
// Dismiss: setToast(null)

// In JSX:
{toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
```

---

## Task 2 — Delete task button in task list

**File:** `apps/frontend/src/app/projects/[id]/page.tsx`

### 2a — Add `handleDeleteTask` function

Add this function to the `ProjectTasksPage` component (after `handleExecute`):

```tsx
const handleDeleteTask = async (tid: string) => {
    if (!confirm('Delete this task?')) return
    try {
        await apiFetch(`/api/projects/${projectId}/tasks/${tid}`, { method: 'DELETE' })
        setSelectedTaskId(prev => prev === tid ? null : prev)
        fetchTasks()
        setToast({ message: 'Task deleted', type: 'success' })
    } catch {
        setToast({ message: 'Failed to delete task', type: 'error' })
    }
}
```

### 2b — Add toast state

Add to the component's state declarations (near the top with the other `useState` calls):
```tsx
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
```

### 2c — Add delete button to each task card

In the task list, each task is rendered as a `<button>` element. Replace the task card button with a wrapper `<div>` so you can add the delete button alongside it. Find the task map:

```tsx
{loading ? <p className="text-sm text-gray-400">Loading...</p> : tasks.map(t => (
    <button
        key={t.id}
        onClick={() => setSelectedTaskId(t.id)}
        className={`w-full text-left p-3 border rounded-lg text-sm transition-colors ${selectedTaskId === t.id ? 'border-blue-600 bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
    >
        <div className="flex justify-between items-start mb-1">
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${getStatusColor(t.status)}`}>
                {t.status}
            </span>
            <span className="text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span>
        </div>
        <p className="line-clamp-2 text-gray-700">{t.input}</p>
    </button>
))}
```

Replace with:

```tsx
{loading ? <p className="text-sm text-gray-400">Loading...</p> : tasks.map(t => (
    <div key={t.id} className="relative group">
        <button
            onClick={() => setSelectedTaskId(t.id)}
            className={`w-full text-left p-3 border rounded-lg text-sm transition-colors ${selectedTaskId === t.id ? 'border-blue-600 bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
        >
            <div className="flex justify-between items-start mb-1">
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${getStatusColor(t.status)}`}>
                    {t.status}
                </span>
                <span className="text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="line-clamp-2 text-gray-700">{t.input}</p>
        </button>
        <button
            onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id) }}
            className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs"
            title="Delete task"
        >
            ×
        </button>
    </div>
))}
```

### 2d — Add Toast import and render

At the top of the file, add the import:
```tsx
import Toast from '@/components/Toast'
```

In the JSX return (at the very end of the outer `<div className="grid...">`, before the closing `</div>`):
```tsx
{toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
```

---

## Task 3 — Toast on task creation success

Still in `apps/frontend/src/app/projects/[id]/page.tsx`.

In `handleCreateTask`, after `fetchTasks()` (in the success branch where there are no `clarificationQuestions`), add:
```tsx
setToast({ message: 'Task created', type: 'success' })
```

In the `catch` block, after `setCreationError(err)`, add:
```tsx
setToast({ message: err?.message ?? 'Failed to create task', type: 'error' })
```

---

## Architecture context

```
apiFetch (lib/api.ts) — throws on non-2xx responses (the error has .message)
DELETE /api/projects/:projectId/tasks/:taskId → 204 No Content (backend Wave 5)
PATCH (Wave 8 Codex, coming) — not needed in this wave's frontend work
Toast component: fixed bottom-right, auto-dismisses after 3s, z-50
group-hover pattern: parent div has 'group' class, child button has 'hidden group-hover:flex'
```

---

## How to submit

1. `git checkout -b agent/frontend-v5` from main
2. Modify/create files at their EXACT paths in `apps/frontend/src/`
3. `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors
4. Commit with descriptive message
5. Write report in `AGENTS_CHAT.md` under `## Wave 8 → Gemini`:
   - Files changed
   - tsc result
   - Any deviations
6. Tell the human "done, agent/frontend-v5 ready for review"

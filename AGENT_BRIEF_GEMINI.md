# Agent Brief — Gemini
## Wave 9 | Branch: `agent/frontend-v6`

**Stack:** Next.js 14 + App Router + TypeScript + Tailwind CSS.

**Rules:**
- New branch from main: `git checkout -b agent/frontend-v6`
- Work ONLY in `apps/frontend/src/` — no other directories
- Do NOT run npm install or npx — just write TypeScript/TSX files
- Do NOT merge — Claude reviews
- On finish: write report to `AGENTS_CHAT.md` under `## Wave 9 → Gemini`
- Validation: `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors

**IMPORTANT:** Files you create or modify MUST be at their EXACT path in `apps/frontend/src/`. Do NOT create files in the repo root.

---

## What already exists (DO NOT rewrite)

```
apps/frontend/src/
  app/
    projects/[id]/
      page.tsx        ← tasks page — THIS IS THE ONLY FILE YOU EDIT
      layout.tsx, profile/, knowledge/, settings/, error.tsx, loading.tsx
  components/
    Toast.tsx         ← already exists, use as-is
    ApprovalPanel.tsx
  hooks/useTaskStream.ts
  lib/api.ts
```

**Do NOT touch any file other than `apps/frontend/src/app/projects/[id]/page.tsx`.**

---

## Current state of `page.tsx` (key parts)

State declarations (lines ~20–33):
```tsx
const [tasks, setTasks] = useState<Task[]>([])
const [loading, setLoading] = useState(true)
const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
const [statusFilter, setStatusFilter] = useState<string>('ALL')
const [input, setInput] = useState('')
const [submitting, setSubmitting] = useState(false)
const [creationError, setCreationError] = useState<any>(null)
const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
const [clarificationTaskId, setClarificationTaskId] = useState<string | null>(null)
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
```

`fetchTasks` (line ~39):
```tsx
const fetchTasks = () => {
    const qs = statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''
    apiFetch<{ data: Task[] }>(`/api/projects/${projectId}/tasks?pageSize=20${qs}`)
        .then(({ data }) => setTasks(data))
        .finally(() => setLoading(false))
}
```

Task detail panel — PENDING block (line ~201):
```tsx
{selectedTask.status === 'PENDING' && (
    <button onClick={() => handleExecute(selectedTask.id)}
        className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700">
        Execute Workflow (Scenario {selectedTask.scenario})
    </button>
)}
```

The task input block (line ~188):
```tsx
<div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap text-gray-800 border">
    {selectedTask.input}
</div>
```

---

## Task 1 — Inline task input editor for PENDING / REJECTED tasks

When the selected task is in `PENDING` or `REJECTED` status, show an "Edit" button next to the task input display. Clicking it replaces the read-only input block with an editable textarea. Saving calls `PATCH /api/projects/:projectId/tasks/:taskId`.

### 1a — Add edit state

Add these two state variables alongside the existing state declarations:
```tsx
const [editingInput, setEditingInput] = useState(false)
const [editInputValue, setEditInputValue] = useState('')
```

### 1b — Add `handleSaveInput` handler

Add after `handleDeleteTask`:
```tsx
const handleSaveInput = async () => {
    if (!selectedTask) return
    try {
        await apiFetch(`/api/projects/${projectId}/tasks/${selectedTask.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ input: editInputValue }),
        })
        setEditingInput(false)
        fetchTasks()
        setToast({ message: 'Task updated', type: 'success' })
    } catch (err: any) {
        setToast({ message: err?.message ?? 'Failed to update task', type: 'error' })
    }
}
```

### 1c — Replace the input display block

Find the read-only input display:
```tsx
<div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap text-gray-800 border">
    {selectedTask.input}
</div>
```

Replace with:
```tsx
{editingInput ? (
    <div className="space-y-2">
        <textarea
            value={editInputValue}
            onChange={e => setEditInputValue(e.target.value)}
            className="w-full border rounded p-3 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
            <button onClick={handleSaveInput}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">
                Save
            </button>
            <button onClick={() => setEditingInput(false)}
                className="px-4 py-1.5 rounded text-sm border hover:bg-gray-50">
                Cancel
            </button>
        </div>
    </div>
) : (
    <div className="relative group/input">
        <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap text-gray-800 border">
            {selectedTask.input}
        </div>
        {(selectedTask.status === 'PENDING' || selectedTask.status === 'REJECTED') && (
            <button
                onClick={() => { setEditInputValue(selectedTask.input); setEditingInput(true) }}
                className="absolute top-2 right-2 hidden group-hover/input:block text-xs text-gray-400 hover:text-blue-600 bg-white border rounded px-2 py-0.5"
            >
                Edit
            </button>
        )}
    </div>
)}
```

Note: `editingInput` must reset when `selectedTaskId` changes. Add this effect after the existing `useEffect`:
```tsx
useEffect(() => { setEditingInput(false) }, [selectedTaskId])
```

---

## Task 2 — Pagination: "Load more" on task list

Currently `fetchTasks` always fetches `pageSize=20` from page 1. Add a "Load more" button that appends the next page.

### 2a — Add pagination state

Add alongside existing state:
```tsx
const [page, setPage] = useState(1)
const [hasMore, setHasMore] = useState(false)
```

### 2b — Update `fetchTasks`

Replace the existing `fetchTasks`:
```tsx
const fetchTasks = (resetPage = true) => {
    const currentPage = resetPage ? 1 : page
    if (resetPage) setPage(1)
    const qs = statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''
    apiFetch<{ data: Task[]; total: number }>(`/api/projects/${projectId}/tasks?page=${currentPage}&pageSize=20${qs}`)
        .then(({ data, total }) => {
            setTasks(prev => resetPage ? data : [...prev, ...data])
            setHasMore((resetPage ? data.length : tasks.length + data.length) < total)
        })
        .finally(() => setLoading(false))
}
```

### 2c — Add `loadMore` handler

After `fetchTasks`:
```tsx
const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    const qs = statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''
    apiFetch<{ data: Task[]; total: number }>(`/api/projects/${projectId}/tasks?page=${nextPage}&pageSize=20${qs}`)
        .then(({ data, total }) => {
            setTasks(prev => [...prev, ...data])
            setHasMore(tasks.length + data.length < total)
        })
}
```

### 2d — Add "Load more" button

After the task list (after the `tasks.map(...)` block, before the closing `</div>` of the list container), add:
```tsx
{hasMore && (
    <button onClick={loadMore}
        className="w-full text-xs text-gray-500 border rounded py-2 hover:bg-gray-50 mt-2">
        Load more
    </button>
)}
```

### 2e — Reset page on filter change

The `useEffect` that calls `fetchTasks` on filter change already calls `fetchTasks()` — since the updated signature has `resetPage = true` as default, no change needed there.

---

## Architecture context

```
PATCH /api/projects/:projectId/tasks/:taskId — added in Wave 8 Codex
  Body: { input: string }  (min 1, max 5000)
  Only PENDING and REJECTED tasks are editable; others return 400
  Returns: { data: Task }

GET /api/projects/:projectId/tasks — existing endpoint
  Query: page (default 1), pageSize (default 20), status (optional)
  Returns: { data: Task[], total: number }

apiFetch throws on non-2xx. The error object has .message.
Toast component is at @/components/Toast — already imported in page.tsx.
group-hover/input is Tailwind named group syntax (requires 'group/input' on parent).
```

---

## How to submit

1. `git checkout -b agent/frontend-v6` from main
2. Edit ONLY `apps/frontend/src/app/projects/[id]/page.tsx`
3. `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors
4. Commit with descriptive message
5. Write report in `AGENTS_CHAT.md` under `## Wave 9 → Gemini`:
   - Tasks completed
   - tsc result
   - Any deviations
6. Tell the human "done, agent/frontend-v6 ready for review"

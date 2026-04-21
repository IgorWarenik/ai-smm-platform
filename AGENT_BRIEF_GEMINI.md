# Agent Brief — Gemini
## Branch: `agent/frontend`

**Stack:** Next.js 14 + App Router + TypeScript + Tailwind CSS. Scaffold already exists.

**You are a subcontractor. Claude is the orchestrator.**
- All work goes in `apps/frontend/src/` — no other directories
- Do NOT run npm install, do NOT run npx commands — just write TypeScript/TSX files
- Do NOT merge — Claude reviews and merges
- On finish: write report to `AGENTS_CHAT.md` under `## Wave 3 (continued) → Gemini`

---

## What already exists (DO NOT rewrite)

```
apps/frontend/
  package.json              ← installed, do not touch
  tsconfig.json             ← configured, do not touch
  next.config.ts            ← do not touch
  tailwind.config.ts        ← do not touch
  src/
    app/
      layout.tsx            ← root layout with AuthProvider — do not touch
      page.tsx              ← redirects / → /dashboard — do not touch
      globals.css           ← Tailwind base — do not touch
    lib/
      api.ts                ← apiFetch, setTokens, clearTokens — DONE ✅
    contexts/
      auth.tsx              ← AuthProvider, useAuth — DONE ✅
    middleware.ts           ← route protection — DONE ✅
```

---

## What you need to write

All files go in `apps/frontend/src/`. Use Tailwind CSS utility classes only — no external component libraries. No new dependencies.

**Import pattern:**
```typescript
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/contexts/auth'
```

---

## Task 1 — /login page

**File:** `apps/frontend/src/app/login/page.tsx`

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-6">Sign In</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-sm text-center">
            No account?{' '}
            <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
```

---

## Task 2 — /register page

**File:** `apps/frontend/src/app/register/page.tsx`

Same pattern as login. Fields: `name`, `email`, `password`. On submit: `await register(email, password, name)`. On success: redirect to `/dashboard`.

---

## Task 3 — /dashboard page

**File:** `apps/frontend/src/app/dashboard/page.tsx`

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'
import { apiFetch } from '@/lib/api'

type Project = { id: string; name: string; description?: string }

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: Project[] }>('/api/projects')
      .then(({ data }) => setProjects(data))
      .catch(() => {})
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
        <p className="text-gray-500">Loading...</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-500">No projects yet. Create your first one.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}
              className="block border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
              <h2 className="font-semibold text-lg">{p.name}</h2>
              {p.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Task 4 — /projects/new page

**File:** `apps/frontend/src/app/projects/new/page.tsx`

Form: `name` (required text) + `description` (optional textarea). On submit: `apiFetch('/api/projects', { method: 'POST', body: JSON.stringify({ name, description }) })`. On success: `router.push('/projects/' + data.id)`. Back link to `/dashboard`.

---

## Task 5 — /projects/[id] layout

**File:** `apps/frontend/src/app/projects/[id]/layout.tsx`

```typescript
import Link from 'next/link'

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const { id } = params
  return (
    <div>
      <nav className="border-b bg-white px-6 py-3 flex items-center gap-6">
        <Link href={`/projects/${id}`}
          className="text-sm font-medium hover:text-blue-600">Tasks</Link>
        <Link href={`/projects/${id}/profile`}
          className="text-sm font-medium hover:text-blue-600">Profile</Link>
        <Link href={`/projects/${id}/knowledge`}
          className="text-sm font-medium hover:text-blue-600">Knowledge</Link>
        <Link href="/dashboard"
          className="ml-auto text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
      </nav>
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  )
}
```

---

## Task 6 — /projects/[id] tasks page

**File:** `apps/frontend/src/app/projects/[id]/page.tsx`

This is the main page. Implement these sections:

### 6a — Task creation form
```typescript
// State: input string, submitError string, lastResult: null | TaskResult
// On submit: POST /api/projects/:id/tasks { input }
// 201 → show TaskCard (score, status PENDING, Execute button)
// 202 → show ClarificationForm (clarificationQuestions array)
// 422 → show rejection message (res.error, res.details.score, res.details.reasoning)
```

### 6b — Task list
```typescript
// On mount: GET /api/projects/:id/tasks?pageSize=20
// Show list of tasks with: input preview, status badge, createdAt
// Clicking a task → opens TaskDetail panel (see 6c)
// Status badge colors:
//   PENDING → yellow, RUNNING → blue, AWAITING_APPROVAL → purple,
//   AWAITING_CLARIFICATION → orange, COMPLETED → green, REJECTED → red, QUEUED → gray
```

### 6c — Task detail
```typescript
// Selected task: show full input, score, scenario, status
// If AWAITING_CLARIFICATION: show ClarificationForm
// If PENDING: show Execute button (POST /api/projects/:id/tasks/:tid/execute)
// If RUNNING: show SSE stream (useTaskStream hook, see Task 8)
// If AWAITING_APPROVAL: show ApprovalPanel (see Task 7)
// If COMPLETED: show latest agentOutputs from task.executions[0].agentOutputs
```

**ClarificationForm** (inline component):
```typescript
// Props: questions: string[], taskId: string, projectId: string, onDone: (task: any) => void
// Renders the questions as a list
// Single <textarea> for combined answer
// On submit: POST /api/projects/:id/tasks/:tid/clarify { answer }
// On success: call onDone(updatedTask)
```

---

## Task 7 — ApprovalPanel component

**File:** `apps/frontend/src/components/ApprovalPanel.tsx`

```typescript
'use client'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'

type Props = {
  projectId: string
  taskId: string
  agentOutputs?: Array<{ agentType: string; content: string }>
  onDecision: (result: any) => void
}

export default function ApprovalPanel({ projectId, taskId, agentOutputs, onDecision }: Props) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (decision: 'APPROVED' | 'REVISION_REQUESTED') => {
    if (decision === 'REVISION_REQUESTED' && comment.trim().length < 50) {
      setError('Revision feedback must be at least 50 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await apiFetch<any>(
        `/api/projects/${projectId}/tasks/${taskId}/approvals`,
        { method: 'POST', body: JSON.stringify({ decision, comment: comment || undefined }) }
      )
      onDecision(result)
    } catch (err: any) {
      setError(err.message ?? 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-purple-50 space-y-4">
      <h3 className="font-semibold">Review Output</h3>

      {agentOutputs && agentOutputs.length > 0 && (
        <div className="space-y-2">
          {agentOutputs.map((o, i) => (
            <div key={i} className="bg-white border rounded p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">{o.agentType}</p>
              <p className="text-sm whitespace-pre-wrap">{o.content}</p>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Feedback (required for Revision Request, min 50 chars)
        </label>
        <textarea
          value={comment}
          onChange={e => { setComment(e.target.value); setError('') }}
          rows={3}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Describe what needs to be changed..."
        />
        <p className="text-xs text-gray-400">{comment.trim().length}/50 min</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => submit('APPROVED')} disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          Approve
        </button>
        <button onClick={() => submit('REVISION_REQUESTED')} disabled={loading}
          className="bg-orange-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
          Request Revision
        </button>
      </div>
    </div>
  )
}
```

---

## Task 8 — useTaskStream hook

**File:** `apps/frontend/src/hooks/useTaskStream.ts`

```typescript
import { useEffect, useState } from 'react'
import { getAccessToken } from '@/lib/api'

type StreamEvent = { type: string; agentType?: string; content?: string; error?: string }

export function useTaskStream(
  projectId: string,
  taskId: string,
  enabled: boolean
): StreamEvent[] {
  const [events, setEvents] = useState<StreamEvent[]>([])

  useEffect(() => {
    if (!enabled) return
    setEvents([])

    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const token = getAccessToken()
    const url = `${API_BASE}/api/projects/${projectId}/tasks/${taskId}/stream`

    // Pass token as query param (EventSource doesn't support headers)
    const es = new EventSource(`${url}?token=${token ?? ''}`)

    es.onmessage = (e) => {
      try {
        const data: StreamEvent = JSON.parse(e.data)
        setEvents((prev) => [...prev, data])
      } catch {}
    }

    es.onerror = () => es.close()

    return () => es.close()
  }, [projectId, taskId, enabled])

  return events
}
```

---

## Task 9 — /projects/[id]/profile page

**File:** `apps/frontend/src/app/projects/[id]/profile/page.tsx`

- On mount: `GET /api/projects/:id/profile` — if 404, show "Create Profile" state
- Form fields (all optional except companyName, description, niche):
  - `companyName` text input
  - `description` textarea
  - `niche` text input
  - `geography` text input  
  - `usp` textarea
  - `keywords` text input (comma-separated, convert to/from array)
  - `forbidden` text input (comma-separated, convert to/from array)
  - `tov` select with options: FORMAL, FRIENDLY, EXPERT, CASUAL, INSPIRATIONAL
- On submit: `PUT /api/projects/:id/profile` with full object
- Show success/error message after submit

---

## Task 10 — /projects/[id]/knowledge page

**File:** `apps/frontend/src/app/projects/[id]/knowledge/page.tsx`

**Sections:**

### Search
Input + button → `GET /api/projects/:id/knowledge/search?q=encodeURIComponent(query)` → show results list with content preview and category badge.

### Add item form
Fields:
- `category` select: FRAMEWORK, CASE, TEMPLATE, SEO, PLATFORM_SPEC, BRAND_GUIDE
- `content` textarea (required)
- `title` text input (optional, goes in metadata: `{ metadata: { title } }`)

On submit: `POST /api/projects/:id/knowledge` → add to list on success.

### Knowledge list
`GET /api/projects/:id/knowledge` on mount → paginated list of cards showing category badge + content preview (first 200 chars).

---

## TypeScript rules

- No `any` except where unavoidable (API responses). Use `unknown` + type assertions with guards where possible.
- Every component: `'use client'` at top if it uses state/effects/hooks
- Server components (layout, static pages): no `'use client'` needed
- Import paths: always `@/...` (never relative `../`)
- No hardcoded URLs — use `process.env.NEXT_PUBLIC_API_URL` via `apiFetch` (which handles it)

---

## Validation

After writing all files, run:
```bash
cd apps/frontend && npx tsc --noEmit
```

All TypeScript errors must be fixed before submitting.

---

## How to submit

1. Work directly on branch `agent/frontend` (already exists, already checked out if Claude gave you this branch)
2. Write all files listed in Tasks 1–10
3. Run `cd apps/frontend && npx tsc --noEmit` — must pass with zero errors
4. Commit: `git add apps/frontend/src/ && git commit -m "feat(frontend): pages — login, register, dashboard, projects, tasks, knowledge, profile"`
5. Write report in `AGENTS_CHAT.md` under `## Wave 3 (continued) → Gemini`:
   - Checklist: which pages are done
   - `npx tsc --noEmit` result (pass/fail + error count if fail)
   - Any deviations
6. Tell the human "done, agent/frontend ready for review"

**IMPORTANT:** Do NOT create a new branch. Work on `agent/frontend`. Do NOT run npm install or npx commands other than `npx tsc --noEmit`. Just write `.tsx`/`.ts` files.

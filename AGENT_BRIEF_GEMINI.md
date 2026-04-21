# Agent Brief — Gemini
## Branch: `agent/frontend`

**Stack:** Next.js 14 + App Router + TypeScript + Tailwind CSS + shadcn/ui. API backend runs at `http://localhost:3001` (env: `NEXT_PUBLIC_API_URL`).

**You are a subcontractor. Claude is the orchestrator.**
- All work goes in `apps/frontend/` — do not touch `apps/api/`, `packages/`, or any other directory
- Do NOT merge — Claude reviews and merges
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 3 → Gemini`

---

## API Reference

All endpoints are documented in `docs/API_SPEC.md`. Key ones for this brief:

```
POST   /api/auth/login                           → { data: { user, tokens: { accessToken, refreshToken } } }
POST   /api/auth/register                        → same
POST   /api/auth/refresh                         → { data: { tokens } }
POST   /api/auth/logout                          → 204
GET    /api/auth/me                              → { data: user }

GET    /api/projects                             → { data: [], total, page, pageSize }
POST   /api/projects                             → { data: project }
GET    /api/projects/:id                         → { data: project }
PATCH  /api/projects/:id                         → { data: project }

GET    /api/projects/:id/profile                 → { data: profile }
PUT    /api/projects/:id/profile                 → { data: profile }
PATCH  /api/projects/:id/profile                 → { data: profile }

GET    /api/projects/:id/tasks                   → { data: [], total, page, pageSize }
POST   /api/projects/:id/tasks                   → 201: { data: task, scoring } | 202: { data: task, clarificationQuestions } | 422: { error, code }
POST   /api/projects/:id/tasks/:tid/clarify      → { data: task, clarificationQuestions? }
POST   /api/projects/:id/tasks/:tid/execute      → { data: execution }
GET    /api/projects/:id/tasks/:tid              → { data: task (includes executions+agentOutputs) }
GET    /api/projects/:id/tasks/:tid/stream       → SSE stream (text/event-stream)

POST   /api/projects/:id/tasks/:tid/approvals    → { data: approval, meta }

GET    /api/projects/:id/knowledge               → { data: [], total, page, pageSize }
POST   /api/projects/:id/knowledge               → { data: item }
GET    /api/projects/:id/knowledge/search?q=     → { data: [] }

GET    /api/projects/:id/tasks/:tid/feedback     → { data: [], total, page, pageSize }
POST   /api/projects/:id/tasks/:tid/feedback     → { data: feedback }
```

**Auth:** Bearer token in `Authorization` header. Access token expires in 15 min. Refresh token is 7 days.

**Task status flow:** PENDING → RUNNING → AWAITING_APPROVAL → COMPLETED | REJECTED | QUEUED  
**Score:** ≥40 → 201 PENDING, 25-39 → 202 AWAITING_CLARIFICATION, <25 → 422 REJECTED

---

## Task 1 — Scaffold `apps/frontend/`

Run from repo root:

```bash
npx create-next-app@latest apps/frontend \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git \
  --yes
```

Then initialize shadcn/ui:
```bash
cd apps/frontend && npx shadcn@latest init --yes
```

Install shadcn components needed:
```bash
npx shadcn@latest add button input label form card badge tabs dialog textarea toast select
```

Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Add to root `package.json` workspaces if not already present:
```json
"workspaces": ["apps/*", "packages/*"]
```

Add scripts to `apps/frontend/package.json`:
```json
"dev": "next dev -p 3000",
"build": "next build",
"type-check": "tsc --noEmit"
```

---

## Task 2 — API Client (`apps/frontend/src/lib/api.ts`)

Typed fetch wrapper with automatic JWT token management.

```typescript
// apps/frontend/src/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

let accessToken: string | null = null
let refreshToken: string | null = null

export function setTokens(access: string, refresh: string) {
  accessToken = access
  refreshToken = refresh
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  }
}

export function loadTokensFromStorage() {
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('access_token')
    refreshToken = localStorage.getItem('refresh_token')
  }
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }
}

export function getAccessToken() { return accessToken }
export function getRefreshToken() { return refreshToken }

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) { clearTokens(); return false }
    const { data } = await res.json()
    setTokens(data.tokens.accessToken, data.tokens.refreshToken)
    return true
  } catch {
    clearTokens()
    return false
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  loadTokensFromStorage()

  const makeRequest = (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

  let res = await makeRequest(accessToken)

  if (res.status === 401 && refreshToken) {
    const ok = await refreshAccessToken()
    if (ok) res = await makeRequest(accessToken)
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw Object.assign(new Error(error.error ?? 'Request failed'), {
      status: res.status,
      code: error.code,
    })
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
```

---

## Task 3 — Auth Context (`apps/frontend/src/contexts/auth.tsx`)

```typescript
// apps/frontend/src/contexts/auth.tsx
'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch, setTokens, clearTokens, loadTokensFromStorage, getAccessToken } from '@/lib/api'

type User = { id: string; email: string; name: string }

type AuthCtx = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTokensFromStorage()
    if (getAccessToken()) {
      apiFetch<{ data: User }>('/api/auth/me')
        .then(({ data }) => setUser(data))
        .catch(() => clearTokens())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiFetch<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setTokens(data.tokens.accessToken, data.tokens.refreshToken)
    setUser(data.user)
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { data } = await apiFetch<any>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
    setTokens(data.tokens.accessToken, data.tokens.refreshToken)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
    if (refreshToken) {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {})
    }
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

---

## Task 4 — Middleware (Route Protection)

**File:** `apps/frontend/src/middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
    ?? request.headers.get('authorization')?.replace('Bearer ', '')

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!isPublic && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublic && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

Note: localStorage is not available in middleware (server-side). For robust auth, also store the access token in a cookie when calling `setTokens`. Update `setTokens` in `api.ts`:

```typescript
// Add after localStorage.setItem calls:
document.cookie = `access_token=${access}; path=/; max-age=900; SameSite=Lax`
```

---

## Task 5 — Root Layout + Providers

**File:** `apps/frontend/src/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Marketing Platform',
  description: 'AI-powered marketing automation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
```

---

## Task 6 — /login Page

**File:** `apps/frontend/src/app/login/page.tsx`

Form: email + password. On submit → `useAuth().login()`. On success → redirect to `/dashboard`. Show error toast on failure.

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <p className="text-sm text-center">
              No account? <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Task 7 — /register Page

**File:** `apps/frontend/src/app/register/page.tsx`

Same pattern as login. Fields: name + email + password. On success → redirect to `/dashboard`.

---

## Task 8 — /dashboard Page (Project List)

**File:** `apps/frontend/src/app/dashboard/page.tsx`

- On mount: `apiFetch('/api/projects')` → render project cards
- Each card: project name, role badge, link to `/projects/[id]`
- Button: "New Project" → `/projects/new`
- Logout button in top-right (calls `useAuth().logout()`)

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Project = { id: string; name: string; memberRole?: string }

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: Project[] }>('/api/projects')
      .then(({ data }) => setProjects(data))
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <div className="flex gap-2">
          <Button asChild><Link href="/projects/new">New Project</Link></Button>
          <Button variant="outline" onClick={handleLogout}>Logout</Button>
        </div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-500">No projects yet. Create your first one.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {p.memberRole && <Badge variant="outline">{p.memberRole}</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Task 9 — /projects/new Page

**File:** `apps/frontend/src/app/projects/new/page.tsx`

Form: `name` (required) + `description` (optional). On submit → `POST /api/projects`. On success → redirect to `/projects/[newId]`.

---

## Task 10 — /projects/[id] Layout + Navigation

**File:** `apps/frontend/src/app/projects/[id]/layout.tsx`

Render a top nav with tabs: Tasks | Profile | Knowledge. Current tab highlighted based on pathname.

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
      <nav className="border-b px-6 py-3 flex gap-6">
        <Link href={`/projects/${id}`} className="font-medium hover:text-blue-600">Tasks</Link>
        <Link href={`/projects/${id}/profile`} className="font-medium hover:text-blue-600">Profile</Link>
        <Link href={`/projects/${id}/knowledge`} className="font-medium hover:text-blue-600">Knowledge</Link>
        <Link href="/dashboard" className="ml-auto text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
      </nav>
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  )
}
```

---

## Task 11 — /projects/[id] Tasks Page

**File:** `apps/frontend/src/app/projects/[id]/page.tsx`

**Sections:**
1. **Task creation form** — textarea for task input, submit button
   - 201 response: show task card with score + "Execute" button
   - 202 response: show clarification questions form (answer and resubmit)
   - 422 response: show rejection message with score and reasoning
2. **Task list** — paginated list of tasks with status badges
3. **Task detail panel** — clicking a task shows its executions and agent outputs
4. **Approval UI** — if task is `AWAITING_APPROVAL`, show Approve / Request Revision buttons
5. **SSE stream** — when a task is RUNNING, open SSE connection to `/api/projects/:id/tasks/:tid/stream` and display events in real time

**StatusBadge component** (inline or separate):
```typescript
const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  AWAITING_APPROVAL: 'bg-purple-100 text-purple-800',
  AWAITING_CLARIFICATION: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  QUEUED: 'bg-gray-100 text-gray-800',
}
```

**SSE hook** (`apps/frontend/src/hooks/useTaskStream.ts`):
```typescript
import { useEffect, useState } from 'react'
import { getAccessToken } from '@/lib/api'

type StreamEvent = { type: string; data: string; timestamp?: string }

export function useTaskStream(projectId: string, taskId: string, enabled: boolean) {
  const [events, setEvents] = useState<StreamEvent[]>([])

  useEffect(() => {
    if (!enabled) return
    const token = getAccessToken()
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}/tasks/${taskId}/stream`
    const es = new EventSource(`${url}?token=${token}`)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setEvents((prev) => [...prev, data])
      } catch {}
    }

    es.onerror = () => es.close()

    return () => es.close()
  }, [projectId, taskId, enabled])

  return events
}
```

Note: EventSource doesn't support Authorization headers. The API SSE endpoint should accept token via query param `?token=` — check `apps/api/src/routes/tasks.ts`. If the endpoint only accepts Bearer header, use a polyfill or pass token via cookie.

**Approval component** (`apps/frontend/src/components/ApprovalPanel.tsx`):
```typescript
// Props: taskId, projectId, onDecision: (decision: 'APPROVED' | 'REVISION_REQUESTED') => void
// For REVISION_REQUESTED: show textarea for comment (min 50 chars)
// POST to /api/projects/:projectId/tasks/:taskId/approvals
// { decision: 'APPROVED' | 'REVISION_REQUESTED', comment?: string }
```

**Clarification component** (`apps/frontend/src/components/ClarificationForm.tsx`):
```typescript
// Props: questions: string[], onAnswer: (answer: string) => Promise<void>
// Renders the questions and a single textarea for the combined answer
// On submit: POST /api/projects/:projectId/tasks/:taskId/clarify { answer: string }
```

---

## Task 12 — /projects/[id]/profile Page

**File:** `apps/frontend/src/app/projects/[id]/profile/page.tsx`

- `GET /api/projects/:id/profile` on mount
- If no profile yet (404): show "Create Profile" form
- If profile exists: show current values with "Edit" button
- Form fields:
  - `companyName` (text, required)
  - `description` (textarea, required)
  - `niche` (text, required)
  - `geography` (text)
  - `usp` (textarea)
  - `keywords` (comma-separated text → array)
  - `forbidden` (comma-separated text → array)
  - `tov` (select: `FORMAL | FRIENDLY | EXPERT | CASUAL | INSPIRATIONAL`)
- On submit: `PUT /api/projects/:id/profile` (full update)

---

## Task 13 — /projects/[id]/knowledge Page

**File:** `apps/frontend/src/app/projects/[id]/knowledge/page.tsx`

**Sections:**
1. **Semantic search bar** — input + search button → `GET /api/projects/:id/knowledge/search?q=...` → show results
2. **Add knowledge item form** — category (select) + content (textarea) + optional title (metadata.title)
3. **Knowledge list** — paginated cards with category badge + content preview

**Categories:** `FRAMEWORK | CASE | TEMPLATE | SEO | PLATFORM_SPEC | BRAND_GUIDE`

---

## Acceptance Criteria

- [ ] `apps/frontend/` exists with valid Next.js 14 App Router structure
- [ ] `npm run build --workspace=apps/frontend` completes without errors
- [ ] `npm run type-check --workspace=apps/frontend` (or `npx tsc --noEmit`) passes
- [ ] All pages are accessible and functional (no runtime import errors)
- [ ] Auth flow: /login → /dashboard → /projects/[id] works end-to-end
- [ ] Unauthenticated user accessing /dashboard → redirected to /login
- [ ] Task creation: 201 shows task card, 202 shows clarification form, 422 shows error
- [ ] SSE stream: events appear when task is RUNNING
- [ ] Approval UI: visible only when task is AWAITING_APPROVAL
- [ ] Knowledge search: results appear after search

---

## Style Rules

- Use Tailwind utility classes only — no inline styles
- Use shadcn/ui components for all form elements and feedback
- No new npm dependencies beyond what `create-next-app` + shadcn installs
- TypeScript strict mode — no `any` casts except where unavoidable
- All client components: `'use client'` directive at top
- No hardcoded `http://localhost:3001` — always use `process.env.NEXT_PUBLIC_API_URL`

---

## How to Submit

1. Create branch: `git checkout -b agent/frontend`
2. All work in `apps/frontend/`
3. Run `npm run build --workspace=apps/frontend` — must pass
4. Run `npx tsc --noEmit -p apps/frontend/tsconfig.json` — must pass
5. Commit with descriptive message
6. Write report in `AGENTS_CHAT.md` under `## Wave 3 → Gemini`:
   - Pages completed (checklist)
   - Build and type-check status
   - Known limitations or deviations
7. Tell the human "done, agent/frontend ready for review"

# Agent Brief — Gemini
## Wave 7 | Branch: `agent/frontend-v4`

**Stack:** Next.js 14 + App Router + TypeScript + Tailwind CSS.

**Rules:**
- New branch from main: `git checkout -b agent/frontend-v4`
- Work ONLY in `apps/frontend/src/` — no other directories
- Do NOT run npm install or npx — just write TypeScript/TSX files
- Do NOT merge — Claude reviews
- On finish: write report to `AGENTS_CHAT.md` under `## Wave 7 → Gemini`
- Validation: `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors

**IMPORTANT:** Files you create MUST go to the exact path specified. Do NOT put files in the repo root. If you create `settings/page.tsx`, it must be at `apps/frontend/src/app/projects/[id]/settings/page.tsx`, not at `./page.tsx` or `./settings/page.tsx`.

---

## What already exists (DO NOT rewrite)

```
apps/frontend/src/
  app/
    projects/[id]/
      page.tsx        ← tasks + status filter
      layout.tsx      ← nav: Tasks | Profile | Knowledge | Settings | ← Dashboard
      profile/page.tsx
      knowledge/page.tsx
      settings/page.tsx   ← project settings (name, members, delete)
      error.tsx, loading.tsx
```

---

## Task 1 — Active nav link highlighting in `projects/[id]/layout.tsx`

The current layout has static nav links with no active state. Update to highlight the current page.

**File:** `apps/frontend/src/app/projects/[id]/layout.tsx`

Change it from a server component to a client component to use `usePathname`:

```tsx
'use client'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const pathname = usePathname()

  const navLinks = [
    { href: `/projects/${id}`, label: 'Tasks', exact: true },
    { href: `/projects/${id}/profile`, label: 'Profile' },
    { href: `/projects/${id}/knowledge`, label: 'Knowledge' },
    { href: `/projects/${id}/settings`, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-4">
        {navLinks.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}>
              {label}
            </Link>
          )
        })}
        <Link href="/dashboard"
          className="ml-auto text-sm text-gray-400 hover:text-gray-600">
          ← Dashboard
        </Link>
      </nav>
      <main className="max-w-5xl mx-auto p-6">
        {children}
      </main>
    </div>
  )
}
```

---

## Task 2 — Dashboard project cards show task count

Update `apps/frontend/src/app/dashboard/page.tsx`.

Change the `Project` type to include `_count`:
```tsx
type Project = {
  id: string
  name: string
  description?: string
  _count?: { tasks: number }
}
```

Update the project card to show the task count:
```tsx
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
```

Note: the backend `GET /api/projects` may not return `_count`. The card should render correctly whether `_count` is present or not (use `p._count !== undefined` guard).

---

## Task 3 — Empty state improvement on tasks page

In `apps/frontend/src/app/projects/[id]/page.tsx`, improve the empty task state.

Find where tasks are rendered (the list on the left column). When `!loading && tasks.length === 0` AND there's no status filter active, show a helpful empty state:

```tsx
{!loading && tasks.length === 0 && (
  <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
    <p className="text-sm font-medium">No tasks yet</p>
    {statusFilter === 'ALL' ? (
      <p className="text-xs mt-1">Create your first task above</p>
    ) : (
      <p className="text-xs mt-1">No tasks with status "{statusFilter.replace(/_/g, ' ')}"</p>
    )}
  </div>
)}
```

Place this BEFORE the existing `tasks.map(...)` rendering, not replacing it.

---

## Architecture context

```
usePathname() — from 'next/navigation', returns current URL path
  e.g. /projects/abc-123/knowledge → pathname = "/projects/abc-123/knowledge"

The Tasks link needs exact: true matching because /projects/:id is a prefix
of all other project routes — without exact match, Tasks would always appear active.

The layout currently uses server component (no 'use client').
Adding usePathname requires 'use client' directive at the top.
```

---

## How to submit

1. `git checkout -b agent/frontend-v4` from main
2. Modify files at their EXACT paths in `apps/frontend/src/`
3. `npx tsc --noEmit -p apps/frontend/tsconfig.json` — zero errors
4. Commit with descriptive message
5. Write report in `AGENTS_CHAT.md` under `## Wave 7 → Gemini`:
   - Files changed
   - tsc result
   - Any deviations
6. Tell the human "done, agent/frontend-v4 ready for review"

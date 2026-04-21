# Agent Brief — Codex
## Wave 11 | Branch: `agent/e2e-v1`

**Stack:** Playwright + TypeScript. Тестирует Next.js frontend (port 3000) против реального Fastify API (port 3001).

**Rules:**
- New branch from main: `git checkout -b agent/e2e-v1`
- Work ONLY in assigned files (все новые — в `apps/e2e/`)
- Do NOT touch any existing files
- Do NOT merge — Claude reviews
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 11 → Codex`
- Validation: `cd apps/e2e && npm install && npx playwright install chromium && npx playwright test --list`
  (--list не запускает тесты, только проверяет синтаксис и обнаружение)

---

## Your Files (all new)

```
apps/e2e/package.json
apps/e2e/playwright.config.ts
apps/e2e/tests/auth.spec.ts
apps/e2e/tests/projects.spec.ts
apps/e2e/.gitignore
```

---

## File: `apps/e2e/package.json`

```json
{
  "name": "@ai-marketing/e2e",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "test:list": "playwright test --list"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0"
  }
}
```

---

## File: `apps/e2e/.gitignore`

```
node_modules/
playwright-report/
test-results/
.playwright/
```

---

## File: `apps/e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

---

## File: `apps/e2e/tests/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`
}

async function register(page: Parameters<Parameters<typeof test>[1]>[0], email: string) {
  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123!')
  await page.getByRole('button', { name: 'Register' }).click()
  await page.waitForURL('/dashboard')
}

test.describe('Authentication', () => {
  test('register → dashboard', async ({ page }) => {
    await register(page, uniqueEmail())
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  })

  test('logout → /login, then login → dashboard', async ({ page }) => {
    const email = uniqueEmail()
    await register(page, email)

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.waitForURL('/login')

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('password123!')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/dashboard')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  })

  test('wrong password → error visible', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody@e2e.test')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.locator('p.text-red-600')).toBeVisible()
  })

  test('unauthenticated /dashboard → redirect to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login')
  })
})
```

---

## File: `apps/e2e/tests/projects.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`
}

async function loginNew(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Tester')
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('password123!')
  await page.getByRole('button', { name: 'Register' }).click()
  await page.waitForURL('/dashboard')
}

test.describe('Projects', () => {
  test('new user sees empty state', async ({ page }) => {
    await loginNew(page)
    await expect(page.getByText('No projects yet')).toBeVisible()
  })

  test('create project → visible in dashboard', async ({ page }) => {
    await loginNew(page)

    await page.getByRole('link', { name: 'New Project' }).click()
    await page.waitForURL('/projects/new')

    const projectName = `E2E Project ${Date.now()}`
    await page.getByPlaceholder('My Marketing Campaign').fill(projectName)
    await page.getByRole('button', { name: 'Create Project' }).click()

    // redirects to project tasks page
    await page.waitForURL(/\/projects\/[0-9a-f-]+$/)

    // back to dashboard — project should appear
    await page.goto('/dashboard')
    await expect(page.getByText(projectName)).toBeVisible()
  })

  test('project page shows task creation form', async ({ page }) => {
    await loginNew(page)

    await page.getByRole('link', { name: 'New Project' }).click()
    await page.getByPlaceholder('My Marketing Campaign').fill('Task Form Test')
    await page.getByRole('button', { name: 'Create Project' }).click()
    await page.waitForURL(/\/projects\/[0-9a-f-]+$/)

    await expect(page.getByRole('heading', { name: 'New Task' })).toBeVisible()
    await expect(page.getByPlaceholder('Describe your task...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible()
  })
})
```

---

## Architecture context

```
Frontend port: 3000   (Next.js, apps/frontend)
API port:      3001   (Fastify, apps/api)
Stack start:   docker-compose up (from repo root)

Tests are run against a LIVE stack — they do NOT mock the API.
Task creation requires ANTHROPIC_API_KEY (scoring via Claude).
auth.spec.ts and projects.spec.ts do NOT need ANTHROPIC_API_KEY.

Playwright locators used (match existing HTML):
  page.getByLabel('Name')                  → <label>Name</label> + adjacent input
  page.getByLabel('Email')                 → <label>Email</label> + adjacent input
  page.getByLabel('Password')              → <label>Password</label> + adjacent input
  page.getByRole('button', { name: 'Register' })
  page.getByRole('button', { name: 'Sign In' })
  page.getByRole('button', { name: 'Logout' })
  page.getByRole('link', { name: 'New Project' })
  page.getByRole('heading', { name: 'Projects' })
  page.getByRole('heading', { name: 'New Task' })
  page.getByPlaceholder('My Marketing Campaign')
  page.getByPlaceholder('Describe your task...')
  page.locator('p.text-red-600')           → error message paragraph

Running tests (requires docker stack):
  cd apps/e2e
  BASE_URL=http://localhost:3000 npx playwright test
```

---

## How to submit

1. `git checkout -b agent/e2e-v1` from main
2. Create all 5 files above exactly as specified
3. `cd apps/e2e && npm install && npx playwright install chromium`
4. `npx playwright test --list` — must show 7 tests, 0 errors
5. `cd ../..` — do NOT run actual tests (needs docker stack)
6. Commit with descriptive message
7. Write report in `AGENTS_CHAT.md` under `## Wave 11 → Codex`
8. Tell the human "done, agent/e2e-v1 ready for review"

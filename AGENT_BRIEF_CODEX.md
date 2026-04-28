# Agent Brief — Codex
## Wave 18 | Branch: `agent/wave-18`

**Goal:** Кнопка «Тест модели» в разделе Настройки → Модель AI.

**Rules:**
- Ветка от `fix/project-create-failed-fetch`: `git checkout -b agent/wave-18`
- Не трогать: `WORKPLAN.md`, `apps/workflows/`, n8n-файлы
- Не мержить — Claude ревьюит
- По окончании: коммит, отчёт в `AGENTS_CHAT.md` под `## Wave 18 → Codex`

---

## Контекст

**Stack:** Fastify API (`:3001`), Next.js (`:3002` Docker), PostgreSQL, Redis.
**Test user:** `igorwarenik@gmail.com` / `Admin1234!`
**Дизайн-система:** flat design, shadcn CSS-переменные, Tailwind. Иконки — `lucide-react`.

**Ключевые CSS-паттерны (из tasks/page.tsx):**

```tsx
// Кнопка primary
<button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">

// Кнопка secondary
<button className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">

// Success block
<div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4">

// Error block
<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
```

---

## Task — Кнопка «Тест модели» в Settings

### Что нужно сделать

#### 1. API endpoint — `POST /api/projects/:projectId/model-config/test`

Файл: `apps/api/src/routes/model-config.ts`

- Добавить в `modelConfigRoutes` новый маршрут:

```ts
app.post('/test', async (request, reply) => {
  const { projectId } = request.params as { projectId: string }
  const userId = request.user.sub

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!membership) return reply.notFound('Project not found')

  const start = Date.now()
  try {
    const result = await withTimeout(
      runAgent({
        systemPrompt: 'You are a helpful assistant. Reply briefly.',
        userMessage: 'Reply with exactly one word: OK',
        maxTokens: 20,
        operation: 'model.test',
      }),
      10000,
      'model test'
    )
    return reply.send({
      data: {
        ok: true,
        provider: process.env.MODEL_PROVIDER ?? 'CLAUDE',
        message: result.trim(),
        latencyMs: Date.now() - start,
      },
    })
  } catch (err) {
    return reply.send({
      data: {
        ok: false,
        provider: process.env.MODEL_PROVIDER ?? 'CLAUDE',
        message: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      },
    })
  }
})
```

- `runAgent` уже импортирован из `@ai-marketing/ai-engine` в соседних маршрутах, импортируй так же.
- `withTimeout` — скопируй сигнатуру из `apps/api/src/routes/tasks.ts` (там уже есть эта функция).

#### 2. Frontend — `apps/frontend/src/app/settings/page.tsx`

**Состояние:**

```ts
const [testing, setTesting] = useState(false)
const [testResult, setTestResult] = useState<{ ok: boolean; provider: string; message: string; latencyMs: number } | null>(null)
```

**Функция:**

```ts
const testModel = async () => {
  if (!activeProject) return
  setTesting(true)
  setTestResult(null)
  try {
    const { data } = await apiFetch<{ data: { ok: boolean; provider: string; message: string; latencyMs: number } }>(
      `/api/projects/${activeProject.id}/model-config/test`,
      { method: 'POST' }
    )
    setTestResult(data)
  } catch (err: any) {
    setTestResult({ ok: false, provider: provider, message: err.message ?? 'Ошибка запроса', latencyMs: 0 })
  } finally {
    setTesting(false)
  }
}
```

**Кнопка — добавить рядом с «Сохранить»:**

```tsx
<div className="flex items-center gap-2">
  <button type="submit" disabled={modelSaving}
    className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
    {modelSaving ? 'Сохранение...' : 'Сохранить'}
  </button>
  <button
    type="button"
    onClick={testModel}
    disabled={testing}
    className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
  >
    {testing ? 'Тестирование...' : 'Тест модели'}
  </button>
</div>
```

**Блок результата — добавить сразу под кнопками:**

```tsx
{testResult && (
  testResult.ok ? (
    <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 space-y-1">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        <p className="text-xs font-medium text-green-800 dark:text-green-300">
          Модель {testResult.provider} готова к работе
        </p>
      </div>
      <p className="text-xs text-green-700 dark:text-green-400">Ответ: {testResult.message}</p>
      <p className="text-[11px] text-muted-foreground">{testResult.latencyMs} мс</p>
    </div>
  ) : (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-1">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        <p className="text-xs font-medium text-destructive">
          Ошибка модели {testResult.provider}
        </p>
      </div>
      <p className="text-xs text-destructive/80 break-all">{testResult.message}</p>
    </div>
  )
)}
```

### Что НЕ трогать

- `apps/api/src/routes/tasks.ts`
- `WORKPLAN.md`
- Любые n8n / workflow файлы

---

## Validation

```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -10
# must: 0 errors

npx tsc --noEmit -p apps/frontend/tsconfig.json 2>&1 | head -10
# must: 0 errors

npm --prefix apps/frontend run build 2>&1 | tail -5
# must: pass
```

Вручную в браузере:
1. Открыть Настройки → Модель AI
2. Нажать «Тест модели»
3. Через ~2-5 сек появляется зелёный блок с «Модель CLAUDE готова к работе»
4. Сменить API Key на невалидный → нажать «Тест модели» → красный блок с ошибкой

---

## Reporting

Commit: `feat(wave-18): model test button in Settings/AI Model`

Записать в `AGENTS_CHAT.md` под `## Wave 18 → Codex`:
- Файлы изменены
- tsc + build результаты
- Любые нерешённые вопросы

Сообщить пользователю: **"done, agent/wave-18 ready for review"**

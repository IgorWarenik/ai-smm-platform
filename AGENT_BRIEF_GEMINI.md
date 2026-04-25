# Agent Brief — Gemini
## Wave 15-FE | Branch: `agent/frontend-v10`

**Stack:** Next.js 14 + App Router + TypeScript + Tailwind CSS + shadcn/ui.

---

## Критические правила (нарушались в прошлых волнах)

- **НЕ коммить в main напрямую.** Создай ветку `agent/frontend-v10` от main.
- **НЕ редактируй `AGENTS_CHAT.md` или `WORKPLAN.md` напрямую.** Они — только через branch + PR.
- **НЕ удаляй и не переписывай существующую логику API-вызовов.** Только рестайлинг и реструктуризация.
- **WORKPLAN.md не редактировать** (явный запрет пользователя).

---

## Контекст

Текущий фронтенд (`apps/frontend/`) — тёмный sci-fi glassmorphism дизайн (Rajdhani font, neon, glass panels). Нужно **полностью перестроить** под рабочий кабинет SMM-специалиста: flat минималистичный дизайн, shadcn/ui CSS переменные, новая навигация, новые экраны.

Это **Wave 15-FE** из двух:
- **15-FE (эта волна):** Shell + Design System + Dashboard + New Request + рестайлинг существующих страниц
- **16-FE (следующая волна):** Task Detail (3-column chat) + ContentPreview + Kanban + Calendar

---

## Задачи Wave 15-FE

### 1. Установка shadcn/ui

```bash
cd apps/frontend
npx shadcn@latest init
# Выбери: TypeScript, CSS variables, Tailwind, default style
```

Установи компоненты: `button`, `input`, `textarea`, `select`, `badge`, `card`, `dialog`, `dropdown-menu`, `separator`, `tooltip`, `avatar`, `progress`, `command`, `popover`, `sheet`.

---

### 2. Design system — полная замена globals.css

**Убери всё:** glassmorphism, neon, gradient, Rajdhani, `.glass-panel`, `.glass-panel-soft`, `.btn-primary`, `.btn-secondary`, `.field`, `.field-label`, `.eyebrow`, `.page-title`, `.section-title`, `.status-pill`, `.muted-text`, `.space-page`, `.space-nav`, `.space-container-wide`, `.nav-link`, `.nav-link-active`.

**Установи Inter** через `next/font/google`.

**tailwind.config.ts** — добавь цветовую семантику агентов, платформ и статусов:

```ts
// в extend.colors:
agent: {
  marketer: { bg: '#E6F1FB', fg: '#0C447C' },   // синий
  content:  { bg: '#EEEDFE', fg: '#3C3489' },   // пурпурный
},
platform: {
  instagram: { bg: '#FBEAF0', fg: '#72243E' },
  tiktok:    { bg: '#F1EFE8', fg: '#2C2C2A' },
  telegram:  { bg: '#E6F1FB', fg: '#0C447C' },
  vk:        { bg: '#E6F1FB', fg: '#0C447C' },
  youtube:   { bg: '#FCEBEB', fg: '#791F1F' },
  linkedin:  { bg: '#E6F1FB', fg: '#185FA5' },
},
status: {
  draft:    { bg: 'hsl(var(--muted))',   fg: 'hsl(var(--muted-foreground))' },
  blocked:  { bg: '#FEF3C7',             fg: '#92400E' },
  inwork:   { bg: '#DBEAFE',             fg: '#1E40AF' },
  review:   { bg: '#EDE9FE',             fg: '#5B21B6' },
  done:     { bg: '#D1FAE5',             fg: '#065F46' },
  archived: { bg: 'hsl(var(--muted))',   fg: 'hsl(var(--muted-foreground))' },
},
```

**Эстетика:** flat, плотный, минималистичный. Никаких градиентов, теней, неоновых акцентов. Мягкая граница 1px (`border-border`), скруглённые углы `rounded-lg` для карточек, `rounded-md` для контролов. Типографика: Inter 400/500 только. Заголовки: h1=22px, h2=18px, h3=16px. Тело 14-15px. Sentence case везде, никаких CAPS.

**Иконки:** только `lucide-react`. Размер 16px в строке текста, 20px в кнопках, 24px в навигации.

**Обе темы обязательны** (light и dark). Используй CSS переменные shadcn: `--background`, `--foreground`, `--muted`, `--card`, `--border`, `--primary`. Никаких хардкодов цветов вне палитры.

---

### 3. Routing — реструктуризация

**Текущая структура** (устаревшая):
```
app/
  dashboard/         ← список проектов
  projects/[id]/
    page.tsx         ← tasks
    profile/
    knowledge/
    settings/
    layout.tsx
```

**Новая структура** (`(app)` route group с AppShell):
```
app/
  (auth)/
    login/page.tsx
    register/page.tsx
  (app)/
    layout.tsx       ← AppShell (Sidebar + TopBar)
    dashboard/page.tsx
    new/page.tsx
    tasks/
      page.tsx       ← kanban/list
      [taskId]/page.tsx
    calendar/page.tsx
    library/page.tsx
    project/
      page.tsx       ← профиль компании (Tier 1/2/3)
      knowledge/page.tsx  ← база знаний
    settings/page.tsx
  page.tsx           ← redirect → /dashboard
```

**Active project context** — создай `src/contexts/project.tsx`:
- Читает `projectId` из localStorage при старте
- Если нет — редирект на `/dashboard` (он показывает список проектов для выбора)
- Все API-вызовы используют `activeProjectId` из контекста
- `ProjectProvider` оборачивает `(app)/layout.tsx`

**Middleware** (`src/middleware.ts`) — обновить:
- Неаутентифицированный → `/login`
- Аутентифицированный без `activeProject` в localStorage → `/dashboard`

---

### 4. AppShell (`(app)/layout.tsx`)

```tsx
<div className="flex h-screen overflow-hidden bg-background">
  <Sidebar />                        // 240px → 64px collapsed
  <div className="flex flex-col flex-1 overflow-hidden">
    <TopBar />                       // 52px
    <main className="flex-1 overflow-y-auto p-6 max-w-screen-xl mx-auto w-full">
      {children}
    </main>
  </div>
  <Toaster />                        // sonner, bottom-right
</div>
```

**Sidebar** (`src/components/layout/Sidebar.tsx`):
- 240px expanded / 64px collapsed (toggle кнопка)
- Состояние в localStorage
- Логотип сверху (текст "AI Marketing" или SVG)
- Nav links с lucide иконками:
  | Icon | Label | Route |
  |------|-------|-------|
  | LayoutDashboard | Главная | /dashboard |
  | PlusCircle | Новый запрос | /new |
  | ListTodo | Задачи | /tasks |
  | Calendar | Календарь | /calendar |
  | Library | Библиотека | /library |
  | Building2 | Проект | /project |
  | Settings | Настройки | /settings |
- Активный link: `bg-accent text-accent-foreground`
- Внизу: `<TierProgress />` виджет + CTA "Дополнить профиль" если Tier 2 < 100%

**TopBar** (`src/components/layout/TopBar.tsx`):
- Хлебные крошки (авто из pathname)
- `⌘K` поиск (открывает `<CommandPalette />` — заглушка с TODO)
- Кнопка `+ Новый запрос` (primary, → /new)
- Колокольчик с badge (заглушка, TODO)
- Toggle темы (light/dark)
- Аватар-меню (email + logout)

**TierProgress** (`src/components/layout/TierProgress.tsx`):
- Читает project profile из API
- Считает заполненность Tier 1/2/3 по наличию полей
- Progress bar + текст "Tier 1 — 4/5 заполнено"
- В collapsed sidebar: только progress bar

---

### 5. Dashboard (`/dashboard`)

**Два режима:**

**A) Нет активного проекта** → список проектов для выбора (текущая логика из `app/dashboard/page.tsx`, рестайл под новый дизайн). При клике на проект — сохранить в localStorage + redirect → `/dashboard` (режим B).

**B) Есть активный проект** → SMM dashboard:

```
Привет, [имя] · [дата]

[На согласовании: N] [Ждёт уточнений: N] [В работе: N] [Готово в этом месяце: N ↑M%]

Левая колонка (60%):                    Правая колонка (40%):
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ Требуют вашего ответа        │        │ Быстрые сценарии             │
│ (задачи blocked + review)    │        │ [Новый пост] [Контент-план]  │
│ Каждая строка: статус-иконка,│        │ [Reels-сценарий] [Карусель]  │
│ заголовок, агент, что нужно, │        │ [Серия историй] [Промпт img] │
│ кнопки Открыть / Принять     │        └──────────────────────────────┘
│                              │        ┌──────────────────────────────┐
│ Сейчас в работе              │        │ Следующие 7 дней             │
│ (inwork с progress bar)      │        │ Горизонтальная лента дней    │
│ Стриминг: обновляется через  │        │ с пиллами постов             │
│ SSE (useEffect на SSE)       │        └──────────────────────────────┘
└──────────────────────────────┘
```

**Метрики** — получать из `GET /api/projects/:id/tasks?status=AWAITING_APPROVAL` и т.д.

**Быстрые сценарии** — 6 кнопок 2×3. Клик → `/new?type=<type>`. Типы: `post`, `content-plan`, `reels`, `carousel`, `stories`, `image-prompt`.

**7 дней** — GET tasks с дедлайном в ближайшие 7 дней. Пиллы = платформа + первые 20 символов. Клик → `/tasks/[id]`. Данных нет — заглушка "Нет запланированных постов".

---

### 6. New Request (`/new`)

Главный вход в систему.

```tsx
// src/app/(app)/new/page.tsx

// Layout: центрированная колонка max-w-2xl
// Заголовок: "Что нужно сделать?"
// MultimodalInput (см. ниже)
// Тип задачи — chip-row (single-select)
// Платформа — chip-row (multi-select, появляется для контентных типов)
// Приоритет — small chips (Срочно / Стандарт / Низкий)
// TaskQualityScore (появляется после 3+ слов в поле)
// Кнопки: [Отправить агентам] [Сохранить как черновик]
```

**Компонент `<MultimodalInput>`** (`src/components/MultimodalInput.tsx`):
```tsx
Props: {
  value: string
  onChange: (v: string) => void
  onSubmit: (payload: { text: string, attachments: File[], urls: string[] }) => void
  placeholder?: string
  disabled?: boolean
}
```
- `<textarea>` auto-grow, min 120px
- Панель инструментов снизу: 📎 Прикрепить файл · 🎙 Голос (заглушка с TODO) · 🔗 URL
- Прикреплённые файлы: chip-row над textarea с крестиком удаления
- Drag & drop по всему полю (react-dropzone)
- Принимать: PDF, DOCX, TXT, MD, PNG, JPG, XLSX

**Типы задач** (chip-row, single-select):
```
Контент: Пост · Карусель · Истории · Reels-сценарий · TikTok-сценарий · Контент-план · Промпт для изображения
Стратегия: SMM-стратегия · Анализ ЦА · Анализ конкурентов · Медиаплан
Mixed: SMM-кампания запуск
[Авто-определение] — default chip
```

**Платформы** (multi-select, только для Контент-типов):
```
Instagram · TikTok · Telegram · VK · YouTube · LinkedIn · X · Pinterest
```
Каждый chip с цветом из platform-палитры и иконкой lucide.

**TaskQualityScore** (`src/components/TaskQualityScore.tsx`):
```
Оценка постановки         37 / 50
────────────────────────────────────
Ясность цели          9/10  ─────────
Полнота контекста      6/10  ──────       ← подсветить
Определённость ЦА      8/10  ────────
Технические требования 5/10  ─────        ← подсветить
Критерии успеха        9/10  ─────────
────────────────────────────────────
[Принимается в работу] / [Будут уточнения] / [Вернуться на доработку]
```
- Дебаунс 500ms по завершении печати
- **TODO: Нет реального бэкенд-эндпоинта для live scoring.** Мокать через статичный подсчёт: считай ключевые слова (платформа, тип, ЦА, объём) → выводи scores. Реальный scoring вызывается при отправке задачи.
- Цвета: 40-50 = green, 25-39 = amber, <25 = red
- Под низкими критериями — inline-подсказка

**Отправка задачи:**
```ts
// POST /api/projects/:projectId/tasks
body: { input: combinedText, metadata: { type, platforms, priority } }
// После создания задачи → redirect /tasks/[taskId]
```
Приложенные файлы — пока TODO (загружать через `POST /api/projects/:id/knowledge/upload` из Wave 15c).

---

### 7. Рестайлинг существующих страниц

Перенеси и переоформи в новой структуре `(app)/`:

**`/project`** (было `/projects/[id]/profile`):
- Полностью переоформить под Tier 1/2/3 accordion (3 уровня, у каждого progress bar)
- Tier 1: companyName, description, niche, geography, products, audience (min 1 сегмент)
- Tier 2: usp, competitors, tov, keywords, forbidden, references
- Tier 3: websiteUrl, socialLinks, kpi, existingContent
- Каждый раздел — карточка с click-to-edit (не форма)
- TOV: preset-chips (Официальный/Дружеский/Экспертный/Провокационный) + поля keywords/forbidden как textarea
- Кнопка "Заполнить через ассистента" — заглушка TODO
- API: `GET /api/projects/:id/profile`, `PUT /api/projects/:id/profile`

**`/project/knowledge`** (было `/projects/[id]/knowledge`):
- Перенести логику из текущей страницы
- Добавить вкладки: [Текст] [Загрузить файл]
- Вкладка Загрузить файл: `<FileDropzone>` (react-dropzone) + category select + кнопка Upload
- Upload: `POST /api/projects/:id/knowledge/upload` (endpoint из Wave 15c-Codex, может ещё не быть — добавь TODO)
- Индикаторы состояния файловых items: uploading / processing / embedding / ready / failed

**`/settings`** (было `/projects/[id]/settings`):
- Вкладки: Профиль · Модель AI · Команда · Уведомления · Внешний вид · Тариф
- Вкладка Модель AI — перенести из текущего Profile (provider/key/url)
- Вкладка Команда — список members, invite, remove
- Остальные — заглушки TODO

---

### 8. Компоненты

Создай в `src/components/`:

**`<PlatformChip>`** (`PlatformChip.tsx`):
```tsx
Props: { platform: string; selected?: boolean; onClick?: () => void; size?: 'sm' | 'md' }
// Цвет и иконка из platform-палитры
// Иконки: Instagram=Camera, TikTok=Music, Telegram=Send, VK=Users, YouTube=Play, LinkedIn=Briefcase, X=X, Pinterest=Grid
```

**`<AgentAvatar>`** (`AgentAvatar.tsx`):
```tsx
Props: { type: 'MARKETER' | 'CONTENT_MAKER' | 'EVALUATOR'; size?: number }
// Круг 28px, инициал М/К/О, цвет из agent-палитры
```

**`<StatusBadge>`** (`StatusBadge.tsx`):
```tsx
Props: { status: TaskStatus }
// Маппинг TaskStatus → status-палитра
// PENDING/REJECTED → draft, AWAITING_CLARIFICATION → blocked, RUNNING → inwork,
// AWAITING_APPROVAL → review, COMPLETED → done, FAILED/QUEUED → muted
```

**`<FileDropzone>`** (`FileDropzone.tsx`):
```tsx
Props: { onFiles: (files: File[]) => void; accept?: string[]; maxSizeMB?: number }
// react-dropzone, drag highlight, превью миниатюр, прогресс загрузки
```

---

### 9. Что НЕ делать в этой волне

- ❌ Task detail (`/tasks/[taskId]`) — это Wave 16-FE
- ❌ Kanban `/tasks` — Wave 16-FE
- ❌ Calendar `/calendar` — Wave 16-FE
- ❌ Library `/library` — Wave 16-FE
- ❌ VoiceRecorder — TODO заглушка
- ❌ CommandPalette — TODO заглушка
- ❌ Social OAuth — отдельная Wave 17
- ❌ MSW setup — опционально, только если нужно для разработки

---

### 10. API-маппинг (что реально существует)

```
GET    /api/projects                                    ← список проектов
POST   /api/projects                                    ← создать проект
GET    /api/projects/:id                                ← один проект
PATCH  /api/projects/:id                                ← обновить
DELETE /api/projects/:id                                ← удалить

GET    /api/projects/:id/profile                        ← получить профиль
PUT    /api/projects/:id/profile                        ← создать/заменить
PATCH  /api/projects/:id/profile                        ← частично обновить

GET    /api/projects/:id/tasks?status=&page=&pageSize=  ← список задач
POST   /api/projects/:id/tasks                          ← создать задачу
GET    /api/projects/:id/tasks/:taskId                  ← одна задача
PATCH  /api/projects/:id/tasks/:taskId                  ← обновить input
DELETE /api/projects/:id/tasks/:taskId                  ← удалить
POST   /api/projects/:id/tasks/:taskId/execute          ← запустить
POST   /api/projects/:id/tasks/:taskId/clarify          ← уточнить
GET    /api/projects/:id/tasks/:taskId/sse              ← SSE стриминг

GET    /api/projects/:id/tasks/:taskId/approvals        ← история
POST   /api/projects/:id/tasks/:taskId/approvals        ← одобрить/отклонить

GET    /api/projects/:id/knowledge                      ← список
POST   /api/projects/:id/knowledge                      ← создать (текст)
PATCH  /api/projects/:id/knowledge/:itemId              ← редактировать
DELETE /api/projects/:id/knowledge/:itemId              ← удалить
GET    /api/projects/:id/knowledge/search?q=            ← семантический поиск
POST   /api/projects/:id/knowledge/upload               ← загрузить файл (Wave 15c-Codex, TODO если нет)

GET    /api/projects/:id/members                        ← список участников
DELETE /api/projects/:id/members/:memberId              ← удалить участника

GET    /api/model-config                                ← провайдер/ключи
PUT    /api/model-config                                ← обновить

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me
POST   /api/auth/logout
```

Эндпоинтов `/library`, `/calendar`, `/notifications/ws`, `/transcribe`, `/converter/preview` **не существует**. Используй `// TODO: clarify with backend` и заглушки.

---

### 11. Validation

```bash
npx tsc --noEmit -p apps/frontend/tsconfig.json
npm --prefix apps/frontend run build
# должно быть 0 errors
```

---

### 12. Отчёт

По завершении напиши отчёт в `AGENTS_CHAT.md` (через PR) в секцию `## Wave 15-FE → Gemini — DONE`:
- Что сделано
- Что осталось TODO (с точными путями файлов)
- Результаты `tsc --noEmit` и `npm run build`
- Список изменённых файлов

---

## What already exists (контекст)

```
apps/frontend/src/
  app/
    dashboard/page.tsx     ← список проектов, перенести логику
    projects/[id]/
      page.tsx             ← tasks page, логику перенести в (app)/tasks/
      layout.tsx           ← заменить на AppShell
      profile/page.tsx     ← перенести в (app)/project/page.tsx
      knowledge/page.tsx   ← перенести в (app)/project/knowledge/page.tsx
      settings/page.tsx    ← перенести в (app)/settings/page.tsx
    login/page.tsx         ← рестайлить (без glassmorphism)
    register/page.tsx      ← рестайлить
  components/
    ApprovalPanel.tsx      ← оставить, использовать позже в Wave 16-FE
    Toast.tsx              ← заменить на sonner (shadcn)
  contexts/auth.tsx        ← оставить, добавить ProjectContext рядом
  hooks/useTaskStream.ts   ← оставить как есть
  lib/api.ts               ← оставить, API endpoints не меняются
  middleware.ts            ← обновить под новые роуты
  app/globals.css          ← ПОЛНОСТЬЮ заменить
  app/layout.tsx           ← обновить (Inter, Toaster)
```

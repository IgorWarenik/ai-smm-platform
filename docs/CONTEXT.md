# Current Work Context

Этот файл служит для быстрого погружения в текущую задачу и позволяет сократить объем запроса агенту.

## Как использовать
- Заполняй перед началом задачи.
- Обновляй по ходу работы.
- Смотри сюда перед тем, как писать код.
- Для зависимостей добавляй в контекст их контракты, а не реализацию, если задача не требует прямых правок в этих зависимостях.
- Перед чтением файлов зафиксируй контекстный бюджет: что читать, что исключить, какой максимум контекста допустим.

## Template

- Current feature: 
- Spec file: 
- Goal: 
- Max context size: 
- Files to read: 
- Files explicitly excluded: 
- Allowed implementation files: 
- Contracts only: 
- Module to change: 
- Dependency contracts to include: 
- Dependency implementations excluded: 
- Agent protocol: docs/agent_protocol.md, если задача меняет связь агентов
- Tool protocol: docs/tool_protocol.md, если задача меняет инструменты агентов
- Tests to run: 
- Changed files: 
- Open questions: 

## Пример

- Current feature: marketing task creation
- Spec file: specs/task-lifecycle.md
- Goal: написать тесты для валидации payload и реализовать endpoint
- Max context size: small, до 5 файлов или 2000 строк
- Files to read: specs/task-lifecycle.md, apps/api/src/routes/tasks.ts, apps/api/src/services/scoring.ts, packages/shared/src/schemas.ts, packages/shared/src/enums.ts
- Files explicitly excluded: docs/CLAUDE.md, docs/ARCHITECTURE.md, apps/workflows/**
- Allowed implementation files: apps/api/src/routes/tasks.ts, apps/api/src/services/scoring.ts
- Contracts only: packages/shared/src/schemas.ts, packages/shared/src/enums.ts, packages/shared/src/types.ts
- Module to change: apps/api/src/routes/tasks.ts, apps/api/src/services/scoring.ts
- Dependency contracts to include: packages/shared/src/schemas.ts, packages/shared/src/enums.ts
- Dependency implementations excluded: apps/workflows/**, packages/ai-engine/src/claude.ts
- Agent protocol: не требуется
- Tool protocol: не требуется
- Tests to run: релевантные API/unit tests для tasks
- Changed files: apps/api/src/routes/tasks.ts, apps/api/src/services/scoring.ts
- Open questions: нужно ли сохранять временный статус draft?

## Правила
- Если не знаешь, откуда начать, читай сначала `specs/`.
- Если нет спецификации, создай её или запроси уточнение.
- Рабочий контекст должен быть коротким и понятным.
- `Files to read` — исчерпывающий список файлов, которые агент должен открыть до реализации. Начинай со спецификации, затем контракты, затем изменяемые реализации.
- `Files explicitly excluded` — файлы и папки, которые нельзя добавлять в контекст для этой задачи, даже если они кажутся связанными.
- `Max context size` — жёсткий предел чтения. Используй `small` для локальной правки (до 5 файлов или 2000 строк), `medium` для кросс-модульной задачи (до 10 файлов или 5000 строк), `large` только для архитектурных изменений.
- `Allowed implementation files` — единственные implementation-файлы, которые можно менять в рамках задачи.
- `Contracts only` — зависимости, которые можно читать только как публичные контракты: `types.ts`, Zod schemas, DTO, interfaces, enums, OpenAPI/spec файлы.
- Когда правишь модуль A, а он зависит от модуля B, включай файлы кода модуля A и только публичные контракты модуля B: `*.interface.ts`, `types.ts`, Zod schemas, DTO, enums, interfaces.
- Не включай реализацию модуля B, его приватные методы и внутреннюю бизнес-логику, если задача прямо не требует менять модуль B.
- Если контракт зависимости отсутствует, неполный или противоречит спекам, зафиксируй это в `Open questions` и уточни/создай контракт до реализации.
- Если задача меняет взаимодействие Маркетолога и Контент-мейкера, добавляй в контекст `docs/agent_protocol.md` и не пересобирай handshake заново.
- Для RAG-задач добавляй budget-поля `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity` в контракт и не передавай в промпт неограниченный knowledge context.
- Если задача меняет инструменты агентов, добавляй в контекст `docs/tool_protocol.md`: текущий runtime вызывает tools через Fastify/n8n контракты.

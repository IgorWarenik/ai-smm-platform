# Protocol: Iterative Self-Debugging

Этот протокол обязателен при технических ошибках, багах и неудачных сборках.

## 1. Глаза В Консоли
- Не угадывай причину ошибки по описанию.
- Сначала получи факты: логи, exit code, stack trace, HTTP response body.
- Для TypeScript/Fastify запускай проверки из ближайшего `package.json`.
- Для n8n workflow проверяй payload, callback URL и route map в workflow-файле.
- Для Python scripts/tests используй `pytest` только для ручного `tests/ai_sanity_check.py` или если сознательно меняешь Python helper.

## 2. Цикл
1. Extract: сохрани полный текст ошибки.
2. Analyze: определи тип ошибки и точное место.
3. Hypothesize: сформулируй короткую проверяемую гипотезу.
4. Fix: внеси минимальное изменение.
5. Verify: сам запусти релевантную проверку и смотри exit code.

## 3. HTTP И Workflow Debug
- Fastify health: `GET http://localhost:3001/health`.
- API metrics: `GET http://localhost:3001/metrics`.
- n8n orchestrator: `POST http://localhost:5678/webhook/orchestrator`.
- Если API возвращает validation error, прочитай тело ответа до изменения схем.
- Если workflow падает на handoff, сверяй payload с `docs/agent_protocol.md`.

## 4. Voyage AI И RAG
- Проверь размерность embeddings: текущий контракт — 1024.
- Проверь Redis embedding cache перед повторными provider calls.
- Для RAG проверь `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity`.
- Пустые строки, `null` и слишком большие батчи не должны уходить в embeddings.

## 5. Критерии Завершения
- Ошибка воспроизведена или причина подтверждена логами.
- Исправление минимально и соответствует `specs/`.
- Релевантная проверка запущена; если зависимости отсутствуют, это явно зафиксировано.

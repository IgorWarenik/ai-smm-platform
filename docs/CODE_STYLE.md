# Code Style Guide

## Python Code Style

### General Rules
- **PEP 8** compliance with `black` formatter
- **Type hints** required for all function parameters and return values
- **Docstrings** required for all public functions, classes, and modules
- **Maximum line length:** 88 characters (black default)
- **Imports:** Grouped and sorted with `isort`

### Naming Conventions
```python
# Classes
class MarketingAgent:
class ContentCreator:

# Functions and methods
def create_campaign_strategy():
def generate_social_media_posts():

# Variables
project_id = "123"
user_profile = {}
marketing_campaigns = []
```

### Type Hints Examples
```python
from typing import List, Dict, Optional, Any
from pydantic import BaseModel

def process_task(
    task_id: str,
    input_data: Dict[str, Any],
    project_id: str
) -> Dict[str, Any]:
    """Process a marketing task with given input data."""

class TaskResult(BaseModel):
    content: str
    metadata: Dict[str, Any]
    score: Optional[float] = None
```

### Error Handling
```python
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

def safe_ai_call(api_func, *args, **kwargs):
    try:
        result = api_func(*args, **kwargs)
        logger.info(f"AI call successful: {api_func.__name__}")
        return result
    except Exception as e:
        logger.error(f"AI call failed: {api_func.__name__}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="AI service temporarily unavailable"
        )
```

### Database Operations
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def get_project_tasks(
    session: AsyncSession,
    project_id: str,
    limit: int = 10
) -> List[Task]:
    """Get tasks for a specific project."""
    stmt = select(Task).where(Task.project_id == project_id).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()
```

## TypeScript/JavaScript Code Style

### General Rules
- **ESLint** + **Prettier** configuration
- **TypeScript strict mode** enabled
- **Interface** definitions for all data structures
- **Async/await** preferred over Promises

### Naming Conventions
```typescript
// Interfaces
interface MarketingTask {
  id: string;
  title: string;
  status: TaskStatus;
}

// Types
type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Functions
function createMarketingCampaign(): Promise<Campaign> {
  // implementation
}

// Variables
const projectId = '123';
const userProfile = {};
const marketingTasks: MarketingTask[] = [];

// Token budgets
const maxTokens = getTokenBudget('marketerBrief');
```

### React Component Example
```typescript
import React, { useState, useEffect } from 'react';
import { Task } from '../types/api';

interface TaskListProps {
  projectId: string;
  onTaskSelect: (task: Task) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  projectId,
  onTaskSelect
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      const data = await response.json();
      setTasks(data.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="task-list">
      {tasks.map(task => (
        <div
          key={task.id}
          onClick={() => onTaskSelect(task)}
          className="task-item"
        >
          {task.title}
        </div>
      ))}
    </div>
  );
};
```

## AI Agent Code Style

Инструменты агентов вызываются через публичные Fastify/n8n контракты. Базовое правило, набор `web_search` / `marketing_cases_db` / `knowledge_search` и пример потока описаны в `docs/tool_protocol.md`.

### Agent Definition
```typescript
const response = await fetch(
  `${API_BASE_URL}/api/projects/${projectId}/knowledge/search?` +
    new URLSearchParams({
      q: input,
      limit: '5',
      maxCharsPerChunk: String(RAG_MAX_CHARS_PER_CHUNK),
      maxTotalChars: String(RAG_MAX_TOTAL_CHARS),
      minSimilarity: String(RAG_MIN_SIMILARITY),
    }),
  { headers: { Authorization: `Bearer ${INTERNAL_API_TOKEN}` } }
);
```

### Prompt Templates for Agents
- Use `PromptTemplate` with input variables instead of hard-coded string interpolation.
- Keep few-shot examples minimal: 1-2 concise examples only.
- Store agent prompt templates in `packages/ai-engine/src/prompts/`.
- Use placeholders like `{ragContext}`, `{marketingBrief}`, and `{projectSettings}` to keep prompts dynamic.
- Prefer shorter, structured prompts over lengthy narrative instructions.
- Format prompts using `PromptTemplate.format(...)` so runtime data is injected cleanly and repeated prompts stay compact.

## Database Schema Naming

### Tables
```sql
-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status task_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes
```sql
-- Performance indexes
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Vector indexes (pgvector)
CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (vector vector_cosine_ops);
```

## Testing Code Style

### Unit Test Example
```typescript
import { describe, expect, it, vi } from 'vitest';

describe('knowledge search budget', () => {
  it('does not exceed the total RAG context budget', () => {
    const results = applyRagBudget(
      [
        { content: 'a'.repeat(2000), similarity: 0.9 },
        { content: 'b'.repeat(2000), similarity: 0.85 },
      ],
      { maxCharsPerChunk: 1000, maxTotalChars: 1500, minSimilarity: 0.72 }
    );

    expect(results.map((r) => r.content).join('').length).toBeLessThanOrEqual(1500);
  });
});
```

## Good vs Bad Examples

### Good: Clear Function
```typescript
function calculateCampaignRoi(revenue: number, cost: number, currency = 'USD') {
  if (cost === 0) {
    return { error: 'Cost cannot be zero' };
  }

  const roiPercentage = ((revenue - cost) / cost) * 100;

  return {
    roiPercentage: Math.round(roiPercentage * 100) / 100,
    netProfit: revenue - cost,
    currency,
  };
}
```

### Bad: Unclear Function
```typescript
function calc(x: number, y: number, z = 'USD') {
  if (y === 0) return { error: 'Division by zero' };
  return { r: ((x - y) / y) * 100, p: x - y, c: z };
}
```

## Linting and Formatting

### Pre-commit Configuration
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v9.0.0
    hooks:
      - id: eslint
```

### VS Code Settings
```json
{
  "python.linting.enabled": true,
  "python.linting.ruffEnabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

export interface RagBudget {
  maxCharsPerChunk: number
  maxTotalChars: number
  minSimilarity: number
}

function readPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function readSimilarity(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback
}

export const DEFAULT_RAG_BUDGET: RagBudget = {
  maxCharsPerChunk: readPositiveInt('RAG_MAX_CHARS_PER_CHUNK', 1200),
  maxTotalChars: readPositiveInt('RAG_MAX_TOTAL_CHARS', 4000),
  minSimilarity: readSimilarity('RAG_MIN_SIMILARITY', 0.15),
}

export function resolveRagBudget(overrides: Partial<RagBudget> = {}): RagBudget {
  return {
    maxCharsPerChunk: overrides.maxCharsPerChunk ?? DEFAULT_RAG_BUDGET.maxCharsPerChunk,
    maxTotalChars: overrides.maxTotalChars ?? DEFAULT_RAG_BUDGET.maxTotalChars,
    minSimilarity: overrides.minSimilarity ?? DEFAULT_RAG_BUDGET.minSimilarity,
  }
}

export function applyRagBudget<T extends { content: string; similarity: number }>(
  results: T[],
  budgetInput: Partial<RagBudget> = {}
): T[] {
  const budget = resolveRagBudget(budgetInput)
  let usedChars = 0
  const budgeted: T[] = []

  for (const result of results) {
    if (result.similarity < budget.minSimilarity || usedChars >= budget.maxTotalChars) continue

    const remaining = budget.maxTotalChars - usedChars
    const maxChars = Math.min(budget.maxCharsPerChunk, remaining)
    const content = result.content.slice(0, maxChars)

    budgeted.push({ ...result, content })
    usedChars += content.length
  }

  return budgeted
}

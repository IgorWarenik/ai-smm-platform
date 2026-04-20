import { prisma } from '@ai-marketing/db'
import { embedText } from './embeddings'
import type { KnowledgeCategory } from '@ai-marketing/shared'
import { applyRagBudget, resolveRagBudget } from './rag-budget'

export interface RagResult {
  content: string
  category: string
  similarity: number
  metadata: Record<string, unknown>
}

/**
 * Search the knowledge base using vector similarity.
 * Returns the top-k most relevant chunks formatted as a context string.
 */
export async function retrieveContext(params: {
  query: string
  projectId: string
  limit?: number
  category?: KnowledgeCategory
  maxCharsPerChunk?: number
  maxTotalChars?: number
  minSimilarity?: number
}): Promise<RagResult[]> {
  const { query, projectId, limit = 5, category } = params
  const ragBudget = resolveRagBudget(params)

  const queryVector = await embedText(query)

  // Build a fully-parameterized query to prevent SQL injection via the category value.
  // $queryRawUnsafe requires all dynamic values to be bound as positional params.
  const baseArgs: unknown[] = [
    `[${queryVector.join(',')}]`, // $1 — vector
    projectId,                    // $2 — project_id
    limit,                        // $3 — limit
    ragBudget.minSimilarity,      // $4 — minSimilarity
  ]

  const categoryClause = category ? `AND category = $5` : ''
  if (category) baseArgs.push(category)

  const results = await prisma.$queryRawUnsafe<Array<{
    id: string
    category: string
    content: string
    metadata: Record<string, unknown>
    similarity: number
  }>>(
    `SELECT id, category, content, metadata,
            1 - (embedding <=> $1::vector) AS similarity
     FROM knowledge_items
     WHERE project_id = $2::uuid
     ${categoryClause}
     AND embedding IS NOT NULL
     AND 1 - (embedding <=> $1::vector) >= $4
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    ...baseArgs
  )

  return applyRagBudget(results, ragBudget)
}

/**
 * Format RAG results into a readable context string for agent prompts.
 */
export function formatRagContext(results: RagResult[]): string {
  if (results.length === 0) return ''

  return results
    .map((r, i) => {
      const meta = r.metadata as Record<string, string>
      const title = meta?.title ? ` — ${meta.title}` : ''
      return `[${i + 1}] ${r.category}${title} (relevance: ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`
    })
    .join('\n\n---\n\n')
}

/**
 * Retrieve and format context in one call.
 */
export async function getAgentContext(params: {
  query: string
  projectId: string
  limit?: number
  category?: KnowledgeCategory
  maxCharsPerChunk?: number
  maxTotalChars?: number
  minSimilarity?: number
}): Promise<string> {
  const results = await retrieveContext(params)
  return formatRagContext(results)
}

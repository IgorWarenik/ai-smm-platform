export interface RagPackSource {
  id?: string
  category: string
  content: string
  metadata?: object
  similarity: number
}

export interface RagShortlistItem {
  rank: number
  id?: string
  category: string
  title: string
  similarity: number
  snippet: string
}

export interface RagPack {
  shortlist: RagShortlistItem[]
  promptPack: string
}

export function buildRagPack(results: RagPackSource[]): RagPack {
  const shortlist = results.slice(0, 5).map((item, index) => ({
    rank: index + 1,
    id: item.id,
    category: item.category,
    title: String((item.metadata as Record<string, unknown> | undefined)?.title ?? ''),
    similarity: item.similarity,
    snippet: item.content.slice(0, 280),
  }))

  const promptPack = shortlist
    .slice(0, 3)
    .map((item, index) => `- Thesis ${index + 1}: [${item.category}] ${item.title || 'untitled'} - ${item.snippet}`)
    .join('\n')

  return { shortlist, promptPack }
}

import { createHash } from 'crypto'

function collapseWhitespace(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function shorten(text: string, maxLength = 500): string {
  return text.length <= maxLength ? text : text.slice(0, maxLength)
}

export function normalizeTextForCache(text: string): string {
  return shorten(collapseWhitespace(text))
}

export function hashCachePart(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

export function makeSemanticCacheKey(namespace: string, parts: string[]): string {
  const normalized = parts.map((part) => normalizeTextForCache(part))
  return `${namespace}:${hashCachePart(normalized.join('\n---\n'))}`
}

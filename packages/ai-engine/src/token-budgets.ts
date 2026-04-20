export type TokenBudgetKind =
  | 'scoring'
  | 'evaluatorJson'
  | 'marketerBrief'
  | 'contentGeneration'
  | 'revisionDelta'

function readPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export const TOKEN_BUDGETS: Record<TokenBudgetKind, number> = {
  scoring: readPositiveInt('MAX_TOKENS_SCORING', 512),
  evaluatorJson: readPositiveInt('MAX_TOKENS_EVALUATOR_JSON', 1024),
  marketerBrief: readPositiveInt('MAX_TOKENS_MARKETER_BRIEF', 2400),
  contentGeneration: readPositiveInt('MAX_TOKENS_CONTENT_GENERATION', 4096),
  revisionDelta: readPositiveInt('MAX_TOKENS_REVISION_DELTA', 1500),
}

// Minimum character count for revision feedback passed to content_maker in Scenario D
export const MIN_REVISION_FEEDBACK_CHARS = 50

export function getTokenBudget(kind: TokenBudgetKind): number {
  return TOKEN_BUDGETS[kind]
}

export function getTokenBudgetForOperation(operation?: string): number {
  if (!operation) return TOKEN_BUDGETS.contentGeneration
  const normalized = operation.toLowerCase()
  if (normalized.includes('scoring')) return TOKEN_BUDGETS.scoring
  if (normalized.includes('evaluator')) return TOKEN_BUDGETS.evaluatorJson
  if (normalized.includes('revision')) return TOKEN_BUDGETS.revisionDelta
  if (normalized.includes('marketer')) return TOKEN_BUDGETS.marketerBrief
  return TOKEN_BUDGETS.contentGeneration
}

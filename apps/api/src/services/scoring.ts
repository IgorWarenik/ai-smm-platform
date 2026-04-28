import { getTokenBudget, makeSemanticCacheKey, runAgent } from '@ai-marketing/ai-engine'
import { ScenarioType, TASK_SCORE_THRESHOLD, TaskScoringResult } from '@ai-marketing/shared'

const TASK_SCORING_TIMEOUT_MS = Number(process.env.TASK_SCORING_TIMEOUT_MS || process.env.AGENT_CALL_TIMEOUT_MS || 15000)

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function isMarketingLike(input: string): boolean {
  const normalized = input.toLowerCase()
  return [
    'instagram',
    'insta',
    'post',
    'image',
    'text',
    'mission',
    'brand',
    'campaign',
    'content',
    'copy',
    'ad',
    'ads',
    'social',
    'email',
    'landing',
    'website',
    'seo',
    'marketing',
    'audience',
    'cta',
    'launch',
    'product',
    'инст',
    'пост',
    'сторис',
    'рилс',
    'текст',
    'картин',
    'изображ',
    'мисс',
    'бренд',
    'кампан',
    'контент',
    'реклам',
    'соцсет',
    'лендинг',
    'сайт',
    'аудитор',
    'продукт',
    'маркетинг',
  ].some((keyword) => normalized.includes(keyword))
}

function fallbackScoring(input: string, reasoning: string): TaskScoringResult {
  if (input.trim().length >= 10 && isMarketingLike(input)) {
    return {
      score: 45,
      scenario: ScenarioType.A,
      reasoning,
      isValid: true,
    }
  }

  return {
    score: 0,
    scenario: ScenarioType.A,
    reasoning,
    isValid: false,
  }
}

export async function scoreTask(input: string): Promise<TaskScoringResult> {
  let text: string
  try {
    text = await withTimeout(
      runAgent({
        maxTokens: Math.max(getTokenBudget('scoring'), 1024),
        operation: 'task.scoring',
        semanticCacheKey: makeSemanticCacheKey('task.scoring.v2', [input]),
        systemPrompt: [
          'Return only compact valid JSON. No markdown. No prose.',
          'Score marketing work requests for whether an agent can start useful work.',
          'Treat a clear channel + deliverable + topic as valid even if brand details are missing.',
        ].join(' '),
        userMessage: `Task: ${JSON.stringify(input)}

Return exactly:
{
  "score": 0,
  "scenario": "A",
  "reasoning": "short",
  "isValid": false
}

Scoring rules:
- 0-24: not marketing, impossible to understand, or empty.
- 25-39: marketing-related but missing the deliverable or channel. Add 2-4 clarificationQuestions.
- 40-100: has a marketing deliverable or channel and enough topic/context to begin. isValid true.
- Example valid: "I need an Instagram post with image and text about our mission" => score 55, scenario "A", isValid true.

Scenario:
- A: one content or strategy deliverable.
- B: strategy then content.
- C: independent parallel subtasks.
- D: iterative refinement.`,
      }),
      TASK_SCORING_TIMEOUT_MS,
      'Task scoring'
    )
  } catch (err) {
    const details = err instanceof Error ? err.message : 'unknown scoring error'
    return fallbackScoring(input, `AI scoring fallback: ${details}`)
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return fallbackScoring(input, 'Failed to parse scoring response; accepted by local marketing-task fallback')
  }

  let parsed: { score?: unknown; scenario?: unknown; reasoning?: unknown; isValid?: unknown; clarificationQuestions?: unknown }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return fallbackScoring(input, 'Failed to parse scoring JSON; accepted by local marketing-task fallback')
  }

  const rawScore = Number(parsed.score)
  const score = Math.max(0, Math.min(100, Math.round(rawScore)))
  if (!Number.isFinite(score)) {
    return fallbackScoring(input, 'Scoring response did not include a finite score; accepted by local marketing-task fallback')
  }
  if (score < TASK_SCORE_THRESHOLD && isMarketingLike(input)) {
    return fallbackScoring(input, `AI scoring returned ${score}; accepted by local marketing-task fallback`)
  }

  const scenario = parsed.scenario === ScenarioType.B || parsed.scenario === ScenarioType.C || parsed.scenario === ScenarioType.D
    ? parsed.scenario
    : ScenarioType.A
  const explicitInvalid = parsed.isValid === false || parsed.isValid === 'false'

  const result: TaskScoringResult = {
    score,
    scenario,
    reasoning: String(parsed.reasoning),
    isValid: score >= TASK_SCORE_THRESHOLD && !explicitInvalid,
  }

  if (score >= 25 && score <= 39 && Array.isArray(parsed.clarificationQuestions) && parsed.clarificationQuestions.length > 0) {
    result.clarificationQuestions = parsed.clarificationQuestions.map(String)
  }

  return result
}

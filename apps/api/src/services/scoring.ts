import { getTokenBudget, makeSemanticCacheKey, runAgent } from '@ai-marketing/ai-engine'
import { ScenarioType, TASK_SCORE_THRESHOLD, TaskScoringResult } from '@ai-marketing/shared'

export async function scoreTask(input: string): Promise<TaskScoringResult> {
  const text = await runAgent({
    model: 'claude-haiku-4-5-20251001',
    maxTokens: getTokenBudget('scoring'),
    operation: 'task.scoring',
    semanticCacheKey: makeSemanticCacheKey('task.scoring', [input]),
    systemPrompt: 'You evaluate marketing task quality and return only valid JSON.',
    userMessage: `Evaluate this marketing task and return a JSON object.

Task: "${input}"

Return ONLY valid JSON with this structure:
{
  "score": <integer 0-100>,
  "scenario": <"A"|"B"|"C"|"D">,
  "reasoning": "<brief explanation>",
  "isValid": <true|false>,
  "clarificationQuestions": ["<question>", ...] // required when score is 25-39; omit otherwise
}

Scoring rules:
- score 0-24: task is too vague, incomplete, or not marketing-related → isValid: false
- score 25-39: task is ambiguous and needs clarification → isValid: false, include 2-4 clarificationQuestions that would help improve the task
- score 40-100: valid task → isValid: true

Scenario selection (only when score >= 40):
- A: task requires only one agent (pure marketing strategy OR pure content creation)
- B: task requires strategy first, then content (e.g., campaign launch)
- C: task has independent parallel subtasks (e.g., competitive analysis + website copy)
- D: task requires iterative refinement (e.g., high-conversion landing page)`,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      score: 0,
      scenario: ScenarioType.A,
      reasoning: 'Failed to parse scoring response',
      isValid: false,
    }
  }

  const parsed = JSON.parse(jsonMatch[0])
  const score = Number(parsed.score)
  const result: TaskScoringResult = {
    score,
    scenario: parsed.scenario as ScenarioType,
    reasoning: String(parsed.reasoning),
    isValid: Boolean(parsed.isValid) && score >= TASK_SCORE_THRESHOLD,
  }

  if (score >= 25 && score <= 39 && Array.isArray(parsed.clarificationQuestions) && parsed.clarificationQuestions.length > 0) {
    result.clarificationQuestions = parsed.clarificationQuestions.map(String)
  }

  return result
}

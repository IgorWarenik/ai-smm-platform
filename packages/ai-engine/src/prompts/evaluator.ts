import { PromptTemplate } from '@langchain/core/prompts'
import { EVALUATOR_ROLE_CARD } from './role-cards'

const evaluatorTemplate = new PromptTemplate({
  inputVariables: ['roleCard', 'originalTask', 'marketingOutput', 'contentOutput', 'iteration', 'maxIterations'],
  template: `{roleCard}

## Original Task
{originalTask}

## Marketing Strategy Output
{marketingOutput}

## Content Output
{contentOutput}

## Evaluation Criteria

### Strategy (40 points)
- Relevance to task and audience (0-10)
- Framework application correctness (0-10)
- Actionability and specificity (0-10)
- Completeness — no obvious gaps (0-10)

### Content (40 points)
- Alignment with strategy (0-10)
- Quality of copy — hook, body, CTA (0-10)
- Platform/format appropriateness (0-10)
- Readiness to publish — no placeholders (0-10)

### Integration (20 points)
- Strategy and content work as a unified whole (0-10)
- Addresses the original task fully (0-10)

## Instructions
Return ONLY valid JSON in this exact format:

{{
  "totalScore": <integer 0-100>,
  "strategyScore": <integer 0-40>,
  "contentScore": <integer 0-40>,
  "integrationScore": <integer 0-20>,
  "passed": <true if totalScore >= 75, false otherwise>,
  "feedback": {{
    "strengths": ["<strength 1>", "<strength 2>"],
    "improvements": ["<specific improvement 1>", "<specific improvement 2>"],
    "marketerFeedback": "<specific actionable feedback for the Marketer>",
    "contentMakerFeedback": "<specific actionable feedback for the Content-Maker>"
  }},
  "iteration": {iteration},
  "maxIterations": {maxIterations}
}}

Be specific in feedback — "improve the CTA" is not acceptable. Write "The CTA 'Learn more' is weak for a conversion landing page — replace with a benefit-driven CTA like 'Get your free audit in 24 hours'."
`,
})

export function buildEvaluatorPrompt(context: {
  originalTask: string
  marketingOutput: string
  contentOutput: string
  iteration: number
  maxIterations: number
}): Promise<string> {
  return evaluatorTemplate.format({
    roleCard: EVALUATOR_ROLE_CARD,
    originalTask: context.originalTask,
    marketingOutput: context.marketingOutput,
    contentOutput: context.contentOutput,
    iteration: context.iteration,
    maxIterations: context.maxIterations,
  })
}

export interface EvaluatorResult {
  totalScore: number
  strategyScore: number
  contentScore: number
  integrationScore: number
  passed: boolean
  feedback: {
    strengths: string[]
    improvements: string[]
    marketerFeedback: string
    contentMakerFeedback: string
  }
  iteration: number
  maxIterations: number
}

export function parseEvaluatorResult(text: string): EvaluatorResult | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as EvaluatorResult
  } catch {
    return null
  }
}

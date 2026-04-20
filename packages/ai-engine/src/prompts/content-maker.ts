import { PromptTemplate } from '@langchain/core/prompts'
import { CONTENT_MAKER_ROLE_CARD } from './role-cards'

const contentMakerTemplate = new PromptTemplate({
  inputVariables: ['roleCard', 'marketingBriefSection', 'ragContext', 'projectSettingsSection'],
  template: `{roleCard}

{projectSettingsSection}

## Marketing Brief
{marketingBriefSection}

## Knowledge
<knowledge>
{ragContext}
</knowledge>

## Output
- Format/platform
- Complete content, no placeholders
- CTA
- One-line strategic rationale only when useful
- Image prompt only for image deliverables
`,
})

const contentMakerIterationTemplate = new PromptTemplate({
  inputVariables: ['roleCard', 'originalTask', 'marketingBrief', 'previousOutput', 'evaluatorFeedback', 'iteration', 'ragContext'],
  template: `{roleCard}
Revise content using evaluator feedback. Return standalone, ready-to-publish content.

## Original Task
{originalTask}

## Marketing Brief
{marketingBrief}

## Your Previous Content (Iteration {iteration})
{previousOutput}

## Expert Feedback
{evaluatorFeedback}

## Knowledge
<knowledge>
{ragContext}
</knowledge>
`,
})

export function buildContentMakerPrompt(context: {
  ragContext: string
  marketingBrief?: string
  projectSettings?: Record<string, unknown>
}): Promise<string> {
  return contentMakerTemplate.format({
    roleCard: CONTENT_MAKER_ROLE_CARD,
    marketingBriefSection: context.marketingBrief
      ? `<brief>\n${context.marketingBrief}\n</brief>`
      : 'No marketing brief provided. Work from the task description directly.',
    ragContext: context.ragContext || 'No relevant knowledge base materials found.',
    projectSettingsSection: context.projectSettings
      ? `Project settings:\n${JSON.stringify(context.projectSettings, null, 2)}\n`
      : '',
  })
}

export function buildContentMakerIterationPrompt(context: {
  originalTask: string
  marketingBrief: string
  previousOutput: string
  evaluatorFeedback: string
  iteration: number
  ragContext: string
}): Promise<string> {
  return contentMakerIterationTemplate.format({
    roleCard: CONTENT_MAKER_ROLE_CARD,
    originalTask: context.originalTask,
    marketingBrief: context.marketingBrief,
    previousOutput: context.previousOutput,
    evaluatorFeedback: context.evaluatorFeedback,
    iteration: context.iteration - 1,
    ragContext: context.ragContext || 'No relevant knowledge base materials found.',
  })
}

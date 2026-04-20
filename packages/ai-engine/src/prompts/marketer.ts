import { PromptTemplate } from '@langchain/core/prompts'
import { MARKETER_ROLE_CARD } from './role-cards'

const marketerTemplate = new PromptTemplate({
  inputVariables: ['roleCard', 'ragContext', 'projectSettingsSection'],
  template: `{roleCard}

{projectSettingsSection}

## Knowledge
<knowledge>
{ragContext}
</knowledge>

## Output
- Strategic Brief
- Key Messages (3-5)
- Channels
- Success Metrics
- Assumptions/Risks when needed
`,
})

const marketerIterationTemplate = new PromptTemplate({
  inputVariables: ['roleCard', 'originalTask', 'previousOutput', 'evaluatorFeedback', 'iteration', 'ragContext'],
  template: `{roleCard}
Revise strategy using evaluator feedback. Return a standalone revised strategy.

## Original Task
{originalTask}

## Your Previous Output (Iteration {iteration})
{previousOutput}

## Expert Feedback
{evaluatorFeedback}

## Knowledge
<knowledge>
{ragContext}
</knowledge>
`,
})

export function buildMarketerPrompt(context: {
  ragContext: string
  projectSettings?: Record<string, unknown>
}): Promise<string> {
  return marketerTemplate.format({
    roleCard: MARKETER_ROLE_CARD,
    ragContext: context.ragContext || 'No relevant knowledge base materials found.',
    projectSettingsSection: context.projectSettings
      ? `Project settings:
${JSON.stringify(context.projectSettings, null, 2)}
`
      : '',
  })
}

export function buildMarketerIterationPrompt(context: {
  originalTask: string
  previousOutput: string
  evaluatorFeedback: string
  iteration: number
  ragContext: string
}): Promise<string> {
  return marketerIterationTemplate.format({
    roleCard: MARKETER_ROLE_CARD,
    originalTask: context.originalTask,
    previousOutput: context.previousOutput,
    evaluatorFeedback: context.evaluatorFeedback,
    iteration: context.iteration - 1,
    ragContext: context.ragContext || 'No relevant knowledge base materials found.',
  })
}

'use client'

import AgentAvatar from '@/components/AgentAvatar'
import { cn } from '@/lib/utils'

export type AgentScenario = 'A' | 'B' | 'C' | 'D'
export type ScenarioAgent = 'MARKETER' | 'CONTENT_MAKER' | 'EVALUATOR'

type ScenarioStep = {
  agent: ScenarioAgent
  title: string
  action: string
  handoff?: string
}

const SCENARIOS: Record<AgentScenario, {
  title: string
  description: string
  steps: ScenarioStep[]
  footer?: string
}> = {
  A: {
    title: 'Сценарий A',
    description: 'Один агент делает один понятный deliverable.',
    steps: [
      { agent: 'CONTENT_MAKER', title: 'Контент-мейкер', action: 'готовит материал' },
    ],
  },
  B: {
    title: 'Сценарий B',
    description: 'Сначала стратегия, потом производство контента.',
    steps: [
      { agent: 'MARKETER', title: 'Маркетолог', action: 'собирает стратегию', handoff: 'бриф' },
      { agent: 'CONTENT_MAKER', title: 'Контент-мейкер', action: 'делает материал' },
    ],
  },
  C: {
    title: 'Сценарий C',
    description: 'Агенты работают параллельно, результаты объединяются.',
    steps: [
      { agent: 'MARKETER', title: 'Маркетолог', action: 'ищет стратегические выводы', handoff: 'параллельно' },
      { agent: 'CONTENT_MAKER', title: 'Контент-мейкер', action: 'готовит контентную часть' },
    ],
  },
  D: {
    title: 'Сценарий D',
    description: 'Стратегия, контент, оценка и до 3 итераций правок.',
    steps: [
      { agent: 'MARKETER', title: 'Маркетолог', action: 'собирает стратегию', handoff: 'бриф' },
      { agent: 'CONTENT_MAKER', title: 'Контент-мейкер', action: 'делает черновик', handoff: 'черновик' },
      { agent: 'EVALUATOR', title: 'Оценщик', action: 'проверяет и возвращает правки' },
    ],
    footer: 'Если оценка слабая, правки возвращаются контент-мейкеру.',
  },
}

const DEFAULT_SCENARIO: AgentScenario = 'B'

export function normalizeScenario(value?: string | null): AgentScenario {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' ? value : DEFAULT_SCENARIO
}

export function estimateScenario(taskType: string, text = ''): AgentScenario {
  const normalized = `${taskType} ${text}`.toLowerCase()
  if (/(проверь|оцени|оценк|итерац|доработ|улучш|ревиз)/i.test(normalized)) return 'D'
  if (/(анализ ца|анализ конкурентов|конкурент|исследован|сравни)/i.test(normalized)) return 'C'
  if (/(стратег|кампан|медиаплан|контент-план|запуск)/i.test(normalized)) return 'B'
  return 'A'
}

type Props = {
  scenario?: string | null
  activeAgent?: string | null
  running?: boolean
  compact?: boolean
  title?: string
  className?: string
}

export default function AgentScenarioFlow({
  scenario,
  activeAgent,
  running = false,
  compact = false,
  title = 'Агентный сценарий',
  className,
}: Props) {
  const scenarioKey = normalizeScenario(scenario)
  const config = SCENARIOS[scenarioKey]
  const safeActiveAgent = activeAgent === 'MARKETER' || activeAgent === 'CONTENT_MAKER' || activeAgent === 'EVALUATOR'
    ? activeAgent
    : null

  return (
    <section className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <h2 className="mt-1 text-sm font-medium text-foreground">{config.title}</h2>
        </div>
        {running && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            live
          </span>
        )}
      </div>

      {!compact && (
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{config.description}</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {config.steps.map((step, index) => {
          const isActive = running && (!safeActiveAgent || safeActiveAgent === step.agent)
          const isCurrentAgent = running && safeActiveAgent === step.agent
          return (
            <div key={`${scenarioKey}-${step.agent}-${index}`} className="flex flex-1 flex-col sm:flex-row sm:items-center">
              <div
                className={cn(
                  'relative flex min-h-[82px] flex-1 items-start gap-3 rounded-md border px-3 py-3 transition-colors',
                  isActive
                    ? 'border-blue-300 bg-blue-50/70 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]'
                    : 'border-border bg-background'
                )}
              >
                {isCurrentAgent && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-blue-500">
                    <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping" />
                  </span>
                )}
                <AgentAvatar type={step.agent} size={compact ? 26 : 30} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.action}</p>
                </div>
              </div>

              {index < config.steps.length - 1 && (
                <div className="flex items-center justify-center py-1 sm:px-2 sm:py-0">
                  <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className={cn('h-px w-7 bg-border', running && 'bg-blue-300')} />
                    <span className="whitespace-nowrap">{step.handoff ?? 'handoff'}</span>
                    <span className={cn('h-px w-7 bg-border', running && 'bg-blue-300')} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {config.footer && !compact && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{config.footer}</p>
      )}
    </section>
  )
}

import { cn } from '@/lib/utils'
import { useLang } from '@/contexts/lang'

type AgentType = 'MARKETER' | 'CONTENT_MAKER' | 'EVALUATOR'

const AGENT_CONFIG: Record<AgentType, { bg: string; fg: string; ru: string; en: string; titleKey: 'agentScenario.B.s0.title' | 'agentScenario.B.s1.title' | 'agentScenario.D.s2.title' }> = {
  MARKETER: { bg: '#E6F1FB', fg: '#0C447C', ru: 'М', en: 'M', titleKey: 'agentScenario.B.s0.title' },
  CONTENT_MAKER: { bg: '#EEEDFE', fg: '#3C3489', ru: 'К', en: 'C', titleKey: 'agentScenario.B.s1.title' },
  EVALUATOR: { bg: '#F0FDF4', fg: '#166534', ru: 'О', en: 'E', titleKey: 'agentScenario.D.s2.title' },
}

type Props = {
  type: AgentType
  size?: number
  className?: string
}

export default function AgentAvatar({ type, size = 28, className }: Props) {
  const { lang, t } = useLang()
  const config = AGENT_CONFIG[type]
  if (!config) return null

  return (
    <div
      className={cn('inline-flex items-center justify-center rounded-full text-xs font-medium shrink-0', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: config.bg,
        color: config.fg,
        fontSize: Math.max(10, size * 0.4),
      }}
      title={t(config.titleKey)}
    >
      {lang === 'en' ? config.en : config.ru}
    </div>
  )
}

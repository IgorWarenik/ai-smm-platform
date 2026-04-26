import { cn } from '@/lib/utils'

type AgentType = 'MARKETER' | 'CONTENT_MAKER' | 'EVALUATOR'

const AGENT_CONFIG: Record<AgentType, { bg: string; fg: string; label: string }> = {
  MARKETER:     { bg: '#E6F1FB', fg: '#0C447C', label: 'М' },
  CONTENT_MAKER: { bg: '#EEEDFE', fg: '#3C3489', label: 'К' },
  EVALUATOR:    { bg: '#F0FDF4', fg: '#166534', label: 'О' },
}

type Props = {
  type: AgentType
  size?: number
  className?: string
}

export default function AgentAvatar({ type, size = 28, className }: Props) {
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
      title={type.replace('_', ' ')}
    >
      {config.label}
    </div>
  )
}

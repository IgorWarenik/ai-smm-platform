import { cn } from '@/lib/utils'

const STATUS_MAP: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING:               { bg: '#F9FAFB', fg: '#6B7280', label: 'Черновик' },
  REJECTED:             { bg: '#F9FAFB', fg: '#6B7280', label: 'Отклонено' },
  QUEUED:               { bg: '#F9FAFB', fg: '#6B7280', label: 'В очереди' },
  AWAITING_CLARIFICATION: { bg: '#FEF3C7', fg: '#92400E', label: 'Ждёт уточнений' },
  RUNNING:              { bg: '#DBEAFE', fg: '#1E40AF', label: 'В работе' },
  AWAITING_APPROVAL:    { bg: '#EDE9FE', fg: '#5B21B6', label: 'На согласовании' },
  REVISION_REQUESTED:   { bg: '#FEF3C7', fg: '#92400E', label: 'На доработке' },
  APPROVED:             { bg: '#D1FAE5', fg: '#065F46', label: 'Принято' },
  COMPLETED:            { bg: '#D1FAE5', fg: '#065F46', label: 'Готово' },
  FAILED:               { bg: '#FEE2E2', fg: '#991B1B', label: 'Ошибка' },
}

type Props = {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: Props) {
  const config = STATUS_MAP[status] ?? { bg: '#F9FAFB', fg: '#6B7280', label: status }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={{ backgroundColor: config.bg, color: config.fg }}
    >
      {config.label}
    </span>
  )
}

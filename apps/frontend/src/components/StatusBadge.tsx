'use client'
import { cn } from '@/lib/utils'
import { useLang } from '@/contexts/lang'
import type { TranslationKey } from '@/lib/i18n'

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  PENDING:                 { bg: '#F9FAFB', fg: '#6B7280' },
  REJECTED:                { bg: '#F9FAFB', fg: '#6B7280' },
  QUEUED:                  { bg: '#F9FAFB', fg: '#6B7280' },
  AWAITING_CLARIFICATION:  { bg: '#FEF3C7', fg: '#92400E' },
  RUNNING:                 { bg: '#DBEAFE', fg: '#1E40AF' },
  AWAITING_APPROVAL:       { bg: '#EDE9FE', fg: '#5B21B6' },
  REVISION_REQUESTED:      { bg: '#FEF3C7', fg: '#92400E' },
  APPROVED:                { bg: '#D1FAE5', fg: '#065F46' },
  COMPLETED:               { bg: '#D1FAE5', fg: '#065F46' },
  FAILED:                  { bg: '#FEE2E2', fg: '#991B1B' },
}

type Props = {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: Props) {
  const { t } = useLang()
  const style = STATUS_STYLES[status] ?? { bg: '#F9FAFB', fg: '#6B7280' }
  const key = `status.${status}` as TranslationKey
  const label = t(key) !== key ? t(key) : status

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {label}
    </span>
  )
}

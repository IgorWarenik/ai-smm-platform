'use client'
import { useLang } from '@/contexts/lang'

export default function OldTasksRedirect() {
  const { t } = useLang()
  return <p className="p-8 text-sm text-muted-foreground">{t('common.redirecting')}</p>
}

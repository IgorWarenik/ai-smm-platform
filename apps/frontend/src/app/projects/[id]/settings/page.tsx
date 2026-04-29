'use client'
import { useLang } from '@/contexts/lang'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OldSettingsRedirect() {
  const router = useRouter()
  const { t } = useLang()
  useEffect(() => { router.replace('/settings') }, [router])
  return <p className="p-8 text-sm text-muted-foreground">{t('common.redirecting')}</p>
}

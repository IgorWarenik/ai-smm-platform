'use client'
import { useLang } from '@/contexts/lang'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OldProfileRedirect() {
  const router = useRouter()
  const { t } = useLang()
  useEffect(() => { router.replace('/project') }, [router])
  return <p className="p-8 text-sm text-muted-foreground">{t('common.redirecting')}</p>
}

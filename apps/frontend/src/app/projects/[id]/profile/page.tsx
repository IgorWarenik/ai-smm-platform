'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OldProfileRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/project') }, [router])
  return <p className="p-8 text-sm text-muted-foreground">Перенаправление...</p>
}

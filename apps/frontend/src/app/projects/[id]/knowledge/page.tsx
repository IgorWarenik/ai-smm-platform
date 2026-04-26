'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OldKnowledgeRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/project/knowledge') }, [router])
  return <p className="p-8 text-sm text-muted-foreground">Перенаправление...</p>
}

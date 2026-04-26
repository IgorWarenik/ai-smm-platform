'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OldProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined' && id) {
      const stored = localStorage.getItem('active_project')
      if (!stored) {
        try {
          localStorage.setItem('active_project', JSON.stringify({ id, name: id }))
        } catch { }
      }
      router.replace('/tasks')
    }
  }, [id, router])

  return <>{children}</>
}

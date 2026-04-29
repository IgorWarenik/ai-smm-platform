'use client'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import NewTaskForm from '@/components/NewTaskForm'

const TYPE_PARAM_TO_VALUE: Record<string, string> = {
  'post': 'Пост',
  'content-plan': 'Контент-план',
  'reels': 'Reels-сценарий',
  'carousel': 'Карусель',
  'stories': 'Истории',
  'image-prompt': 'Промпт для изображения',
}

function NewPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')
  const initialType = typeParam ? (TYPE_PARAM_TO_VALUE[typeParam] ?? 'Авто-определение') : 'Авто-определение'

  return (
    <NewTaskForm
      initialType={initialType}
      onSuccess={(taskId, clarify) => {
        router.push(clarify ? `/tasks?selected=${taskId}&clarify=1` : `/tasks?selected=${taskId}`)
      }}
    />
  )
}

export default function NewPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="py-8 text-sm text-muted-foreground">...</div>}>
        <NewPageInner />
      </Suspense>
    </AppShell>
  )
}

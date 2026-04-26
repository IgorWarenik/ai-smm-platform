'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type Criterion = {
  label: string
  score: number
  max: number
  hint?: string
}

type ScoreResult = {
  total: number
  max: number
  criteria: Criterion[]
  verdict: 'accept' | 'clarify' | 'reject'
}

const PLATFORM_KEYWORDS = ['instagram', 'tiktok', 'telegram', 'vk', 'youtube', 'linkedin', 'x', 'pinterest', 'соцсет', 'платформ']
const TYPE_KEYWORDS = ['пост', 'карусель', 'историй', 'reels', 'стратеги', 'контент-план', 'контентплан', 'рекламу', 'копи', 'текст']
const AUDIENCE_KEYWORDS = ['аудитори', 'покупател', 'клиент', 'целевой', 'сегмент', 'возраст', 'пол', 'b2b', 'b2c']
const METRIC_KEYWORDS = ['охват', 'конверси', 'подписчик', 'лиды', 'продажи', 'клик', 'просмотр', 'заказ']

function calcScore(text: string): ScoreResult {
  const lower = text.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean).length

  const hasClarity = words >= 5
  const clarityScore = Math.min(10, Math.floor(words / 3))

  const contextScore = Math.min(10,
    (PLATFORM_KEYWORDS.some(k => lower.includes(k)) ? 3 : 0) +
    (TYPE_KEYWORDS.some(k => lower.includes(k)) ? 3 : 0) +
    (lower.length > 80 ? 2 : lower.length > 40 ? 1 : 0) +
    (text.includes('?') ? 0 : 2)
  )

  const audienceScore = Math.min(10, AUDIENCE_KEYWORDS.some(k => lower.includes(k)) ? 8 : words > 15 ? 4 : 2)

  const techScore = Math.min(10,
    (lower.includes('формат') || lower.includes('объём') || lower.includes('размер') ? 3 : 0) +
    (lower.includes('тон') || lower.includes('стиль') || lower.includes('голос') ? 3 : 0) +
    (lower.includes('пример') || lower.includes('образец') || lower.includes('референс') ? 4 : 0)
  )

  const successScore = Math.min(10, METRIC_KEYWORDS.some(k => lower.includes(k)) ? 9 : words > 20 ? 5 : 3)

  const total = clarityScore + contextScore + audienceScore + techScore + successScore
  const max = 50

  const verdict: ScoreResult['verdict'] =
    total >= 40 ? 'accept' :
    total >= 25 ? 'clarify' :
    'reject'

  return {
    total,
    max,
    verdict,
    criteria: [
      { label: 'Ясность цели', score: clarityScore, max: 10, hint: clarityScore < 6 ? 'Добавьте конкретную цель задачи' : undefined },
      { label: 'Полнота контекста', score: contextScore, max: 10, hint: contextScore < 6 ? 'Укажите платформу и тип контента' : undefined },
      { label: 'Определённость ЦА', score: audienceScore, max: 10, hint: audienceScore < 6 ? 'Опишите целевую аудиторию' : undefined },
      { label: 'Технические требования', score: techScore, max: 10, hint: techScore < 5 ? 'Укажите формат, тон, объём' : undefined },
      { label: 'Критерии успеха', score: successScore, max: 10, hint: successScore < 5 ? 'Какой результат считается успехом?' : undefined },
    ],
  }
}

type Props = {
  text: string
  visible: boolean
}

export default function TaskQualityScore({ text, visible }: Props) {
  const [result, setResult] = useState<ScoreResult | null>(null)

  useEffect(() => {
    if (!visible || !text.trim()) { setResult(null); return }
    const t = setTimeout(() => setResult(calcScore(text)), 500)
    return () => clearTimeout(t)
  }, [text, visible])

  if (!visible || !result) return null

  const pct = Math.round((result.total / result.max) * 100)
  const color = result.verdict === 'accept' ? 'text-green-700' :
    result.verdict === 'clarify' ? 'text-amber-700' : 'text-red-700'
  const bgColor = result.verdict === 'accept' ? 'bg-green-50 border-green-200' :
    result.verdict === 'clarify' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  const verdictLabel = result.verdict === 'accept' ? 'Принимается в работу' :
    result.verdict === 'clarify' ? 'Будут уточнения' : 'Вернуться на доработку'

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', bgColor)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Оценка постановки</span>
        <span className={cn('text-lg font-semibold', color)}>{result.total} / {result.max}</span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/60">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            result.verdict === 'accept' ? 'bg-green-600' :
            result.verdict === 'clarify' ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {result.criteria.map(c => (
          <div key={c.label}>
            <div className="flex items-center justify-between text-xs">
              <span className={cn('text-muted-foreground', c.hint && 'font-medium text-amber-700')}>{c.label}</span>
              <span className="font-medium text-foreground">{c.score}/{c.max}</span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/50">
              <div
                className="h-full rounded-full bg-current opacity-50 transition-all"
                style={{ width: `${(c.score / c.max) * 100}%`, color: c.hint ? '#B45309' : '#059669' }}
              />
            </div>
            {c.hint && <p className="mt-0.5 text-[11px] text-amber-600">{c.hint}</p>}
          </div>
        ))}
      </div>

      <p className={cn('text-xs font-medium', color)}>{verdictLabel}</p>
    </div>
  )
}

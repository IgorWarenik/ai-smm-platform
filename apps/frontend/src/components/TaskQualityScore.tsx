'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLang } from '@/contexts/lang'
import type { TranslationKey } from '@/lib/i18n'

type Criterion = {
  labelKey: TranslationKey
  score: number
  max: number
  hintKey?: TranslationKey
}

type ScoreResult = {
  total: number
  max: number
  criteria: Criterion[]
  verdict: 'accept' | 'clarify' | 'reject'
}

const PLATFORM_KEYWORDS = ['instagram', 'tiktok', 'telegram', 'vk', 'youtube', 'linkedin', 'x', 'pinterest', 'соцсет', 'платформ', 'platform', 'channel']
const TYPE_KEYWORDS = ['пост', 'карусель', 'историй', 'reels', 'стратеги', 'контент-план', 'контентплан', 'рекламу', 'копи', 'текст', 'post', 'carousel', 'stories', 'strategy', 'content', 'copy', 'ad']
const AUDIENCE_KEYWORDS = ['аудитори', 'покупател', 'клиент', 'целевой', 'сегмент', 'возраст', 'пол', 'b2b', 'b2c', 'audience', 'customer', 'client', 'segment']
const METRIC_KEYWORDS = ['охват', 'конверси', 'подписчик', 'лиды', 'продажи', 'клик', 'просмотр', 'заказ', 'reach', 'conversion', 'leads', 'sales', 'click', 'views']

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
      { labelKey: 'score.criterion.clarity', score: clarityScore, max: 10, hintKey: clarityScore < 6 ? 'score.hint.clarity' : undefined },
      { labelKey: 'score.criterion.context', score: contextScore, max: 10, hintKey: contextScore < 6 ? 'score.hint.context' : undefined },
      { labelKey: 'score.criterion.audience', score: audienceScore, max: 10, hintKey: audienceScore < 6 ? 'score.hint.audience' : undefined },
      { labelKey: 'score.criterion.technical', score: techScore, max: 10, hintKey: techScore < 5 ? 'score.hint.technical' : undefined },
      { labelKey: 'score.criterion.success', score: successScore, max: 10, hintKey: successScore < 5 ? 'score.hint.success' : undefined },
    ],
  }
}

type Props = {
  text: string
  visible: boolean
}

export default function TaskQualityScore({ text, visible }: Props) {
  const { t } = useLang()
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
  const verdictLabel = result.verdict === 'accept' ? t('score.verdict.accept') :
    result.verdict === 'clarify' ? t('score.verdict.clarify') : t('score.verdict.reject')

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', bgColor)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{t('score.title')}</span>
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
          <div key={c.labelKey}>
            <div className="flex items-center justify-between text-xs">
              <span className={cn('text-muted-foreground', c.hintKey && 'font-medium text-amber-700')}>{t(c.labelKey)}</span>
              <span className="font-medium text-foreground">{c.score}/{c.max}</span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/50">
              <div
                className="h-full rounded-full bg-current opacity-50 transition-all"
                style={{ width: `${(c.score / c.max) * 100}%`, color: c.hintKey ? '#B45309' : '#059669' }}
              />
            </div>
            {c.hintKey && <p className="mt-0.5 text-[11px] text-amber-600">{t(c.hintKey)}</p>}
          </div>
        ))}
      </div>

      <p className={cn('text-xs font-medium', color)}>{verdictLabel}</p>
    </div>
  )
}

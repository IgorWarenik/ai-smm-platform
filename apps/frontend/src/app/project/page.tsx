'use client'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'
import AppShell from '@/components/layout/AppShell'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOV_OPTIONS = [
  { value: 'OFFICIAL', label: 'Официальный' },
  { value: 'FRIENDLY', label: 'Дружеский' },
  { value: 'EXPERT', label: 'Экспертный' },
  { value: 'PROVOCATIVE', label: 'Провокационный' },
]

type Profile = {
  companyName?: string; description?: string; niche?: string; geography?: string
  products?: string; audience?: string; usp?: string; competitors?: string
  tov?: string; keywords?: string[]; forbidden?: string[]
  websiteUrl?: string; socialLinks?: string; kpi?: string; existingContent?: string
}

type ApiProduct = {
  name: string
  description: string
  price?: string
}

type ApiAudience = {
  segment: string
  portrait: string
  pain_points?: string[]
}

type ApiCompetitor = {
  name: string
  url?: string
  positioning: string
}

type ApiSocialLinks = {
  instagram?: string
  telegram?: string
  vk?: string
  youtube?: string
}

type ApiKpi = {
  cac?: number
  ltv?: number
  conversion_rate?: number
  avg_check?: number
}

type ApiProfile = Omit<Profile, 'products' | 'audience' | 'competitors' | 'socialLinks' | 'kpi'> & {
  products?: ApiProduct[]
  audience?: ApiAudience[]
  competitors?: ApiCompetitor[]
  socialLinks?: ApiSocialLinks
  kpi?: ApiKpi
}

function formatProducts(products?: ApiProduct[]): string {
  if (!Array.isArray(products) || products.length === 0) return ''
  return products
    .map((product) => {
      const left = product.description && product.description !== product.name
        ? `${product.name}: ${product.description}`
        : product.name
      return product.price ? `${left} | ${product.price}` : left
    })
    .join('\n')
}

function parseProducts(text: string): ApiProduct[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [main, pricePart] = line.split('|').map((part) => part.trim())
      const colonIndex = main.indexOf(':')
      const name = colonIndex >= 0 ? main.slice(0, colonIndex).trim() : main
      const description = colonIndex >= 0 ? main.slice(colonIndex + 1).trim() : main
      return {
        name,
        description: description || name,
        ...(pricePart ? { price: pricePart } : {}),
      }
    })
}

function formatAudience(audience?: ApiAudience[]): string {
  if (!Array.isArray(audience) || audience.length === 0) return ''
  return audience
    .map((item) => {
      const left = item.portrait && item.portrait !== item.segment
        ? `${item.segment}: ${item.portrait}`
        : item.segment
      const pains = Array.isArray(item.pain_points) && item.pain_points.length > 0
        ? ` | ${item.pain_points.join(', ')}`
        : ''
      return `${left}${pains}`
    })
    .join('\n')
}

function parseAudience(text: string): ApiAudience[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [main, painPart] = line.split('|').map((part) => part.trim())
      const colonIndex = main.indexOf(':')
      const segment = colonIndex >= 0 ? main.slice(0, colonIndex).trim() : main
      const portrait = colonIndex >= 0 ? main.slice(colonIndex + 1).trim() : main
      return {
        segment,
        portrait: portrait || segment,
        pain_points: painPart
          ? painPart.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
      }
    })
}

function formatCompetitors(competitors?: ApiCompetitor[]): string {
  if (!Array.isArray(competitors) || competitors.length === 0) return ''
  return competitors
    .map((competitor) => {
      const parts = [`${competitor.name}: ${competitor.positioning}`]
      if (competitor.url) parts.push(competitor.url)
      return parts.join(' | ')
    })
    .join('\n')
}

function parseCompetitors(text: string): ApiCompetitor[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [main, urlPart] = line.split('|').map((part) => part.trim())
      const colonIndex = main.indexOf(':')
      const name = colonIndex >= 0 ? main.slice(0, colonIndex).trim() : main
      const positioning = colonIndex >= 0 ? main.slice(colonIndex + 1).trim() : main
      return {
        name,
        positioning: positioning || name,
        ...(urlPart ? { url: urlPart } : {}),
      }
    })
}

function formatSocialLinks(socialLinks?: ApiSocialLinks): string {
  if (!socialLinks || typeof socialLinks !== 'object') return ''
  return Object.entries(socialLinks)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

function parseSocialLinks(text: string): ApiSocialLinks {
  const socialLinks: ApiSocialLinks = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const colonIndex = line.indexOf(':')
    if (colonIndex < 0) continue
    const key = line.slice(0, colonIndex).trim().toLowerCase()
    const value = line.slice(colonIndex + 1).trim()
    if (!value) continue
    if (key === 'instagram' || key === 'telegram' || key === 'vk' || key === 'youtube') {
      socialLinks[key] = value
    }
  }
  return socialLinks
}

function formatKpi(kpi?: ApiKpi): string {
  if (!kpi || typeof kpi !== 'object') return ''
  return Object.entries(kpi)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim().length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

function parseKpi(text: string): ApiKpi {
  const kpi: ApiKpi = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const colonIndex = line.indexOf(':')
    if (colonIndex < 0) continue
    const key = line.slice(0, colonIndex).trim().toLowerCase()
    const value = Number(line.slice(colonIndex + 1).trim().replace(',', '.'))
    if (!Number.isFinite(value)) continue
    if (key === 'cac' || key === 'ltv' || key === 'conversion_rate' || key === 'avg_check') {
      kpi[key] = value
    }
  }
  return kpi
}

function normalizeProfile(data: ApiProfile): Profile {
  return {
    ...data,
    products: formatProducts(data.products),
    audience: formatAudience(data.audience),
    competitors: formatCompetitors(data.competitors),
    socialLinks: formatSocialLinks(data.socialLinks),
    kpi: formatKpi(data.kpi),
  }
}

const TIER1 = [
  { field: 'companyName', label: 'Название компании', required: true },
  { field: 'description', label: 'Описание', required: true, textarea: true },
  { field: 'niche', label: 'Ниша', required: true },
  { field: 'geography', label: 'География' },
  { field: 'products', label: 'Продукты / Услуги', textarea: true },
  { field: 'audience', label: 'Целевая аудитория', textarea: true },
] as const

const TIER2 = [
  { field: 'usp', label: 'УТП (уникальное торговое предложение)', textarea: true },
  { field: 'competitors', label: 'Конкуренты', textarea: true },
] as const

const TIER3 = [
  { field: 'websiteUrl', label: 'Сайт' },
  { field: 'socialLinks', label: 'Соцсети (ссылки)' },
] as const

function calcTierPct(profile: Profile | null, fields: readonly { field: string }[]): number {
  if (!profile) return 0
  const filled = fields.filter(f => {
    const v = (profile as any)[f.field]
    if (Array.isArray(v)) return v.length > 0
    return v && String(v).trim().length > 0
  }).length
  return Math.round((filled / fields.length) * 100)
}

type TierProps = {
  title: string
  pct: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function TierAccordion({ title, pct, children, defaultOpen }: TierProps) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const color = pct === 100 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-muted-foreground'

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {open ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
        <span className="flex-1 text-sm font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <span className={cn('text-xs font-medium', color)}>{pct}%</span>
        </div>
      </button>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  )
}

function FieldView({ label, value, onEdit }: { label: string; value?: unknown; onEdit: () => void }) {
  const display = Array.isArray(value)
    ? value.join(', ')
    : typeof value === 'string'
      ? value
      : value == null
        ? ''
        : JSON.stringify(value, null, 2)
  return (
    <div
      className="group cursor-pointer rounded-md px-3 py-2.5 hover:bg-accent/40 transition-colors"
      onClick={onEdit}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 whitespace-pre-wrap text-sm', display ? 'text-foreground' : 'text-muted-foreground/60 italic')}>
        {display || 'Нажмите для заполнения'}
      </p>
    </div>
  )
}

function ProfilePageInner() {
  const { activeProject, setActiveProject } = useProject()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editField, setEditField] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [projectName, setProjectName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameLoading, setRenameLoading] = useState(false)

  const [keywordsText, setKeywordsText] = useState('')
  const [forbiddenText, setForbiddenText] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeProject) return
    setProjectName(activeProject.name)
    apiFetch<{ data: ApiProfile }>(`/api/projects/${activeProject.id}/profile`)
      .then(({ data }) => setProfile(normalizeProfile(data)))
      .catch(() => setProfile({}))
      .finally(() => setLoading(false))
  }, [activeProject?.id])

  useEffect(() => {
    if (activeProject?.name) {
      setProjectName(activeProject.name)
    }
  }, [activeProject?.name])

  const startEdit = (field: string) => {
    const val = (profile as any)?.[field]
    if (field === 'keywords') { setKeywordsText((val ?? []).join(', ')) }
    else if (field === 'forbidden') { setForbiddenText((val ?? []).join(', ')) }
    else { setEditVal(typeof val === 'string' ? val : val == null ? '' : JSON.stringify(val, null, 2)) }
    setEditField(field)
  }

  const save = async () => {
    if (!activeProject) return
    setSaving(true)
    setSuccess('')
    setError('')
    let update: any = {}
    if (editField === 'keywords') update.keywords = keywordsText.split(',').map(s => s.trim()).filter(Boolean)
    else if (editField === 'forbidden') update.forbidden = forbiddenText.split(',').map(s => s.trim()).filter(Boolean)
    else if (editField === 'products') update.products = parseProducts(editVal)
    else if (editField === 'audience') update.audience = parseAudience(editVal)
    else if (editField === 'competitors') update.competitors = parseCompetitors(editVal)
    else if (editField === 'socialLinks') update.socialLinks = parseSocialLinks(editVal)
    else if (editField === 'kpi') update.kpi = parseKpi(editVal)
    else update[editField!] = editVal
    try {
      const { data } = await apiFetch<{ data: ApiProfile }>(`/api/projects/${activeProject.id}/profile`, {
        method: 'PATCH', body: JSON.stringify(update),
      })
      setProfile(normalizeProfile(data))
      setEditField(null)
      setSuccess('Сохранено')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err: any) {
      setError(err?.message ?? 'Не удалось сохранить поле')
    } finally { setSaving(false) }
  }

  const saveProjectName = async () => {
    if (!activeProject) return
    const nextName = projectName.trim()
    if (!nextName) {
      setError('Название проекта не может быть пустым')
      return
    }

    setRenameLoading(true)
    setError('')
    setSuccess('')
    try {
      const { data } = await apiFetch<{ data: { id: string; name: string } }>(`/api/projects/${activeProject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName }),
      })
      setActiveProject({
        ...activeProject,
        name: data.name,
      })
      setProjectName(data.name)
      setRenaming(false)
      setSuccess('Название обновлено')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err: any) {
      setError(err?.message ?? 'Не удалось обновить название проекта')
    } finally {
      setRenameLoading(false)
    }
  }


  const renderEditField = (field: string, label: string, textarea?: boolean) => {
    if (editField !== field) return null
    return (
      <div className="mt-2 space-y-2">
        {textarea ? (
          <textarea
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            rows={3}
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 min-h-[80px]"
          />
        ) : (
          <input
            type="text"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
        )}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button onClick={() => setEditField(null)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Отмена
          </button>
        </div>
      </div>
    )
  }

  if (!activeProject) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        <a href="/dashboard" className="hover:underline">Выберите проект</a>
      </div>
    )
  }

  const t1pct = calcTierPct(profile, TIER1)
  const t2pct = calcTierPct(profile, TIER2)
  const t3pct = calcTierPct(profile, TIER3)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Управление проектом</p>
          <h1 className="mt-1 text-[22px] font-medium text-foreground">Профиль проекта</h1>
        </div>
        <div className="flex items-center gap-3">
          {success && (
            <span className="flex items-center gap-1 text-xs text-green-700">
              <Check size={12} /> {success}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Название проекта</p>
            {renaming ? (
              <div className="mt-2 max-w-xl space-y-3">
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveProjectName}
                    disabled={renameLoading}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {renameLoading ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={() => {
                      setProjectName(activeProject?.name ?? '')
                      setRenaming(false)
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 text-lg font-medium text-foreground">{activeProject.name}</p>
                <button
                  onClick={() => {
                    setProjectName(activeProject.name)
                    setRenaming(true)
                  }}
                  className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Изменить название
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg border border-border bg-card animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tier 1 */}
          <TierAccordion title="Tier 1 — Базовый профиль" pct={t1pct} defaultOpen>
            <div className="divide-y divide-border">
              {TIER1.map(f => (
                <div key={f.field}>
                  {editField === f.field ? (
                    <div className="py-2.5">
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{f.label}</p>
                      {renderEditField(f.field, f.label, (f as any).textarea)}
                    </div>
                  ) : (
                    <FieldView
                      label={f.label}
                      value={(profile as any)?.[f.field]}
                      onEdit={() => startEdit(f.field)}
                    />
                  )}
                </div>
              ))}
            </div>
          </TierAccordion>

          {/* Tier 2 */}
          <TierAccordion title="Tier 2 — Позиционирование" pct={t2pct}>
            <div className="divide-y divide-border">
              {TIER2.map(f => (
                <div key={f.field}>
                  {editField === f.field ? (
                    <div className="py-2.5">
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{f.label}</p>
                      {renderEditField(f.field, f.label, (f as any).textarea)}
                    </div>
                  ) : (
                    <FieldView label={f.label} value={(profile as any)?.[f.field]} onEdit={() => startEdit(f.field)} />
                  )}
                </div>
              ))}

              {/* TOV */}
              <div>
                {editField === 'tov' ? (
                  <div className="py-2.5">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Тон коммуникации</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {TOV_OPTIONS.map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setEditVal(o.value)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            editVal === o.value
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={save} disabled={saving}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        {saving ? 'Сохранение...' : 'Сохранить'}
                      </button>
                      <button onClick={() => setEditField(null)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <FieldView
                    label="Тон коммуникации"
                    value={TOV_OPTIONS.find(o => o.value === profile?.tov)?.label ?? profile?.tov}
                    onEdit={() => { setEditVal(profile?.tov ?? 'FRIENDLY'); setEditField('tov') }}
                  />
                )}
              </div>

              {/* Keywords */}
              <div>
                {editField === 'keywords' ? (
                  <div className="py-2.5">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Ключевые слова (через запятую)</p>
                    <input
                      type="text"
                      value={keywordsText}
                      onChange={e => setKeywordsText(e.target.value)}
                      autoFocus
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={save} disabled={saving}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        {saving ? 'Сохранение...' : 'Сохранить'}
                      </button>
                      <button onClick={() => setEditField(null)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <FieldView label="Ключевые слова" value={profile?.keywords} onEdit={() => startEdit('keywords')} />
                )}
              </div>

              {/* Forbidden */}
              <div>
                {editField === 'forbidden' ? (
                  <div className="py-2.5">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Запрещённые слова (через запятую)</p>
                    <input
                      type="text"
                      value={forbiddenText}
                      onChange={e => setForbiddenText(e.target.value)}
                      autoFocus
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={save} disabled={saving}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        {saving ? 'Сохранение...' : 'Сохранить'}
                      </button>
                      <button onClick={() => setEditField(null)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <FieldView label="Запрещённые слова" value={profile?.forbidden} onEdit={() => startEdit('forbidden')} />
                )}
              </div>
            </div>
          </TierAccordion>

          {/* Tier 3 */}
          <TierAccordion title="Tier 3 — Расширенный профиль" pct={t3pct}>
            <div className="divide-y divide-border">
              {TIER3.map(f => (
                <div key={f.field}>
                  {editField === f.field ? (
                    <div className="py-2.5">
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{f.label}</p>
                      {renderEditField(f.field, f.label, (f as any).textarea)}
                    </div>
                  ) : (
                    <FieldView label={f.label} value={(profile as any)?.[f.field]} onEdit={() => startEdit(f.field)} />
                  )}
                </div>
              ))}
            </div>
          </TierAccordion>
        </div>
      )}
    </div>
  )
}

export default function ProjectPage() {
  return (
    <AppShell>
      <ProfilePageInner />
    </AppShell>
  )
}

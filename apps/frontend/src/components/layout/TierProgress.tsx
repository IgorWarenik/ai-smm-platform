'use client'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'
import { useEffect, useState } from 'react'

type Profile = {
  companyName?: string
  description?: string
  niche?: string
  geography?: string
  products?: string
  audience?: string
  usp?: string
  competitors?: string
  tov?: string
  keywords?: string[]
  forbidden?: string[]
  websiteUrl?: string
  socialLinks?: string
  kpi?: string
  existingContent?: string
}

const TIER1_FIELDS: (keyof Profile)[] = ['companyName', 'description', 'niche', 'geography', 'products', 'audience']
const TIER2_FIELDS: (keyof Profile)[] = ['usp', 'competitors', 'tov', 'keywords', 'forbidden']
const ALL_TIER_FIELDS = [...TIER1_FIELDS, ...TIER2_FIELDS]

function calcScore(profile: Profile | null): number {
  if (!profile) return 0
  const filled = ALL_TIER_FIELDS.filter(f => {
    const v = profile[f]
    if (Array.isArray(v)) return v.length > 0
    return v && String(v).trim().length > 0
  }).length
  return Math.round((filled / ALL_TIER_FIELDS.length) * 100)
}

export default function TierProgress({ collapsed }: { collapsed: boolean }) {
  const { activeProject } = useProject()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!activeProject) return
    setLoaded(false)
    apiFetch<{ data: Profile }>(`/api/projects/${activeProject.id}/profile`)
      .then(({ data }) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true))
  }, [activeProject?.id])

  if (!activeProject) return null
  if (!loaded) return null

  const pct = calcScore(profile)

  if (collapsed) {
    return (
      <div className="px-3 py-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  const tier1Filled = TIER1_FIELDS.filter(f => {
    const v = profile?.[f]
    if (Array.isArray(v)) return v.length > 0
    return v && String(v).trim().length > 0
  }).length

  return (
    <div className="px-3 py-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Профиль проекта</span>
        <span className="text-xs font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

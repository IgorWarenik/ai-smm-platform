'use client'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useProject } from '@/contexts/project'
import { useAuth } from '@/contexts/auth'
import AppShell from '@/components/layout/AppShell'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type Tab = 'model' | 'team' | 'project' | 'notifications' | 'billing'
type ModelProvider = 'DEEPSEEK' | 'CLAUDE' | 'CHATGPT' | 'GEMINI'

const MODEL_OPTIONS: Array<{ value: ModelProvider; label: string; apiUrl: string }> = [
  { value: 'CLAUDE', label: 'Claude (Anthropic)', apiUrl: 'https://api.anthropic.com' },
  { value: 'CHATGPT', label: 'ChatGPT (OpenAI)', apiUrl: 'https://api.openai.com/v1' },
  { value: 'GEMINI', label: 'Gemini (Google)', apiUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'DEEPSEEK', label: 'DeepSeek', apiUrl: 'https://api.deepseek.com' },
]

type Member = { id: string; userId: string; role: string; user?: { email: string; name: string } }

function SettingsPageInner() {
  const { activeProject, clearActiveProject } = useProject()
  const { user } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('model')

  // Model config
  const [provider, setProvider] = useState<ModelProvider>('CLAUDE')
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState(MODEL_OPTIONS[0].apiUrl)
  const [hasKey, setHasKey] = useState(false)
  const [modelSaving, setModelSaving] = useState(false)
  const [modelMsg, setModelMsg] = useState('')

  // Project settings
  const [projName, setProjName] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projSaving, setProjSaving] = useState(false)
  const [projMsg, setProjMsg] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Team
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeProject) return
    const id = activeProject.id
    apiFetch<{ data: { provider: ModelProvider; apiUrl: string; hasApiKey: boolean } }>(`/api/projects/${id}/model-config`)
      .then(({ data }) => { setProvider(data.provider); setApiUrl(data.apiUrl); setHasKey(data.hasApiKey) })
      .catch(() => { })
    apiFetch<{ data: { name: string; description?: string } }>(`/api/projects/${id}`)
      .then(({ data }) => { setProjName(data.name); setProjDesc(data.description ?? '') })
      .catch(() => { })
  }, [activeProject?.id])

  const loadMembers = () => {
    if (!activeProject) return
    setMembersLoading(true)
    apiFetch<{ data: Member[] }>(`/api/projects/${activeProject.id}/members`)
      .then(({ data }) => setMembers(data))
      .catch(() => { })
      .finally(() => setMembersLoading(false))
  }

  useEffect(() => {
    if (tab === 'team') loadMembers()
  }, [tab, activeProject?.id])

  const saveModel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    setModelSaving(true)
    setModelMsg('')
    try {
      await apiFetch(`/api/projects/${activeProject.id}/model-config`, {
        method: 'PUT',
        body: JSON.stringify({ provider, apiKey, apiUrl }),
      })
      setApiKey('')
      setHasKey(true)
      setModelMsg('Настройки модели сохранены')
    } catch (err: any) {
      setModelMsg(err.message ?? 'Ошибка')
    } finally { setModelSaving(false) }
  }

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    setProjSaving(true)
    setProjMsg('')
    try {
      await apiFetch(`/api/projects/${activeProject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: projName, description: projDesc || undefined }),
      })
      setProjMsg('Проект обновлён')
    } catch (err: any) { setProjMsg(err.message ?? 'Ошибка') }
    finally { setProjSaving(false) }
  }

  const deleteProject = async () => {
    if (!activeProject || deleteConfirm !== activeProject.name) return
    setDeleting(true)
    try {
      await apiFetch(`/api/projects/${activeProject.id}`, { method: 'DELETE' })
      clearActiveProject()
      router.push('/dashboard')
    } catch (err: any) { setProjMsg(err.message ?? 'Ошибка') }
    finally { setDeleting(false) }
  }

  const removeMember = async (memberId: string) => {
    if (!activeProject) return
    setRemovingId(memberId)
    try {
      await apiFetch(`/api/projects/${activeProject.id}/members/${memberId}`, { method: 'DELETE' })
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch { }
    finally { setRemovingId(null) }
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'model', label: 'Модель AI' },
    { id: 'team', label: 'Команда' },
    { id: 'project', label: 'Проект' },
    { id: 'notifications', label: 'Уведомления' },
    { id: 'billing', label: 'Тариф' },
  ]

  if (!activeProject) {
    return <div className="py-10 text-center text-sm text-muted-foreground"><a href="/dashboard" className="hover:underline">Выберите проект</a></div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-[22px] font-medium text-foreground">Настройки</h1>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Model AI */}
      {tab === 'model' && (
        <form onSubmit={saveModel} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Провайдер</label>
            <select
              value={provider}
              onChange={e => {
                const p = e.target.value as ModelProvider
                setProvider(p)
                setApiUrl(MODEL_OPTIONS.find(o => o.value === p)?.apiUrl ?? '')
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">API URL</label>
            <input type="url" value={apiUrl} onChange={e => setApiUrl(e.target.value)} required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              required
              placeholder={hasKey ? 'Ключ сохранён. Введите для замены' : 'Вставьте API ключ'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {modelMsg && <p className="text-sm text-muted-foreground">{modelMsg}</p>}
          <button type="submit" disabled={modelSaving}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {modelSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      )}

      {/* Team */}
      {tab === 'team' && (
        <div className="space-y-4">
          {membersLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.user?.name ?? 'Участник'}</p>
                    <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                  {m.userId !== user?.id && (
                    <button
                      onClick={() => removeMember(m.id)}
                      disabled={removingId === m.id}
                      className="text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      {removingId === m.id ? '...' : 'Удалить'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Приглашение участников — TODO</p>
        </div>
      )}

      {/* Project */}
      {tab === 'project' && (
        <div className="space-y-6">
          <form onSubmit={saveProject} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Название проекта</label>
              <input type="text" value={projName} onChange={e => setProjName(e.target.value)} required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Описание</label>
              <textarea value={projDesc} onChange={e => setProjDesc(e.target.value)} rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 min-h-[80px]" />
            </div>
            {projMsg && <p className="text-sm text-muted-foreground">{projMsg}</p>}
            <button type="submit" disabled={projSaving}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {projSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>

          <div className="rounded-lg border border-destructive/30 p-5 space-y-3">
            <p className="text-sm font-medium text-destructive">Опасная зона</p>
            <p className="text-sm text-muted-foreground">
              Введите <strong className="text-foreground">{activeProject.name}</strong> для подтверждения удаления
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={activeProject.name}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={deleteProject}
                disabled={deleting || deleteConfirm !== activeProject.name}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Настройки уведомлений — TODO</p>
        </div>
      )}

      {tab === 'billing' && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Тарифные планы — TODO</p>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsPageInner />
    </AppShell>
  )
}

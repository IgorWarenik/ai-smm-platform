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
type ProviderKeys = Record<ModelProvider, boolean>

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
  const [providerKeys, setProviderKeys] = useState<ProviderKeys>({ CLAUDE: false, CHATGPT: false, GEMINI: false, DEEPSEEK: false })
  const [modelSaving, setModelSaving] = useState(false)
  const [modelMsg, setModelMsg] = useState('')
  const [lastError, setLastError] = useState<{ provider: string; message: string; timestamp: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; provider: string; message: string; latencyMs: number } | null>(null)

  // Project settings
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Team
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeProject) return
    const id = activeProject.id
    apiFetch<{ data: { provider: ModelProvider; apiUrl: string; hasApiKey: boolean; providerKeys?: ProviderKeys; lastError?: { provider: string; message: string; timestamp: string } | null } }>(`/api/projects/${id}/model-config`)
      .then(({ data }) => {
        setProvider(data.provider)
        setApiUrl(data.apiUrl)
        setHasKey(data.hasApiKey)
        setProviderKeys(data.providerKeys ?? { CLAUDE: data.hasApiKey, CHATGPT: false, GEMINI: false, DEEPSEEK: false })
        setLastError(data.lastError ?? null)
      })
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
      setProviderKeys(prev => ({ ...prev, [provider]: true }))
      setModelMsg('Настройки модели сохранены')
    } catch (err: any) {
      setModelMsg(err.message ?? 'Ошибка')
    } finally { setModelSaving(false) }
  }

  const testModel = async () => {
    if (!activeProject) return
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await apiFetch<{ data: { ok: boolean; provider: string; message: string; latencyMs: number } }>(
        `/api/projects/${activeProject.id}/model-config/test`,
        { method: 'POST', body: JSON.stringify({ provider, apiKey, apiUrl }) }
      )
      setTestResult(data)
    } catch (err: any) {
      setTestResult({ ok: false, provider: provider, message: err.message ?? 'Ошибка запроса', latencyMs: 0 })
    } finally {
      setTesting(false)
    }
  }

  const deleteProject = async () => {
    if (!activeProject || deleteConfirm !== activeProject.name) return
    setDeleting(true)
    try {
      await apiFetch(`/api/projects/${activeProject.id}`, { method: 'DELETE' })
      clearActiveProject()
      router.push('/dashboard')
    } catch { }
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
                setHasKey(providerKeys[p] ?? false)
                setTestResult(null)
                setModelMsg('')
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
              required={!hasKey}
              placeholder={hasKey ? 'Ключ сохранён. Введите для замены' : 'Вставьте API ключ'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <p className="text-xs text-muted-foreground">
              {hasKey ? `Ключ для ${MODEL_OPTIONS.find(o => o.value === provider)?.label ?? provider} сохранён` : 'Для выбранного провайдера ключ не найден'}
            </p>
          </div>
          {lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-1">
              <p className="text-xs font-medium text-destructive">Ошибка модели {lastError.provider}</p>
              <p className="text-xs text-destructive/80 break-all">{lastError.message}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(lastError.timestamp).toLocaleString('ru-RU')}
              </p>
            </div>
          )}
          {modelMsg && <p className="text-sm text-muted-foreground">{modelMsg}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={modelSaving}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {modelSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={testModel}
              disabled={testing}
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {testing ? 'Тестирование...' : 'Тест модели'}
            </button>
          </div>
          {testResult && (
            testResult.ok ? (
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <p className="text-xs font-medium text-green-800 dark:text-green-300">
                    Модель {testResult.provider} готова к работе
                  </p>
                </div>
                <p className="text-xs text-green-700 dark:text-green-400">Ответ: {testResult.message}</p>
                <p className="text-[11px] text-muted-foreground">{testResult.latencyMs} мс</p>
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  <p className="text-xs font-medium text-destructive">
                    Ошибка модели {testResult.provider}
                  </p>
                </div>
                <p className="text-xs text-destructive/80 break-all">{testResult.message}</p>
              </div>
            )
          )}
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
          <p className="text-xs text-muted-foreground">Для приглашения участников обратитесь к администратору через API.</p>
        </div>
      )}

      {/* Project */}
      {tab === 'project' && (
        <div className="space-y-6">
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

'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const TOV_OPTIONS = ['OFFICIAL', 'FRIENDLY', 'EXPERT', 'PROVOCATIVE']

type Profile = {
  companyName: string
  description: string
  niche: string
  geography?: string
  usp?: string
  keywords?: string[]
  forbidden?: string[]
  tov?: string
}

type Project = { id: string; name: string; description?: string }
type ModelProvider = 'DEEPSEEK' | 'CLAUDE' | 'CHATGPT' | 'GEMINI'

const MODEL_OPTIONS: Array<{ value: ModelProvider; label: string; apiUrl: string }> = [
  { value: 'DEEPSEEK', label: 'DeepSeek', apiUrl: 'https://api.deepseek.com' },
  { value: 'CLAUDE', label: 'Claude', apiUrl: 'https://api.anthropic.com' },
  { value: 'CHATGPT', label: 'ChatGPT', apiUrl: 'https://api.openai.com/v1' },
  { value: 'GEMINI', label: 'Gemini', apiUrl: 'https://generativelanguage.googleapis.com/v1beta' },
]

const parseCommaList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)

export default function ProfilePage() {
  const { id: projectId } = useParams() as { id: string }
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [name, setName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [projectSuccess, setProjectSuccess] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [modelProvider, setModelProvider] = useState<ModelProvider>('CLAUDE')
  const [modelApiKey, setModelApiKey] = useState('')
  const [modelApiUrl, setModelApiUrl] = useState(MODEL_OPTIONS[1].apiUrl)
  const [modelHasKey, setModelHasKey] = useState(false)
  const [modelSaving, setModelSaving] = useState(false)
  const [modelError, setModelError] = useState('')
  const [modelSuccess, setModelSuccess] = useState('')

  const [form, setForm] = useState<Profile>({
    companyName: '', description: '', niche: '',
    geography: '', usp: '', keywords: [], forbidden: [], tov: 'FRIENDLY',
  })
  const [keywordsText, setKeywordsText] = useState('')
  const [forbiddenText, setForbiddenText] = useState('')

  useEffect(() => {
    setLoading(true)

    apiFetch<{ data: Project }>(`/api/projects/${projectId}`)
      .then(({ data }) => {
        setProject(data)
        setName(data.name)
        setProjectDescription(data.description ?? '')
      })
      .catch((err) => setProjectError(err.message ?? 'Project load failed'))

    apiFetch<{ data: Profile }>(`/api/projects/${projectId}/profile`)
      .then(({ data }) => {
        setProfile(data)
        setForm({
          companyName: data.companyName ?? '',
          description: data.description ?? '',
          niche: data.niche ?? '',
          geography: data.geography ?? '',
          usp: data.usp ?? '',
          keywords: data.keywords ?? [],
          forbidden: data.forbidden ?? [],
          tov: data.tov ?? 'FRIENDLY',
        })
        setKeywordsText((data.keywords ?? []).join(', '))
        setForbiddenText((data.forbidden ?? []).join(', '))
      })
      .catch((err) => { if (err.status === 404) setEditing(true) })
      .finally(() => setLoading(false))

    apiFetch<{ data: { provider: ModelProvider; apiUrl: string; hasApiKey: boolean } }>(`/api/projects/${projectId}/model-config`)
      .then(({ data }) => {
        setModelProvider(data.provider)
        setModelApiUrl(data.apiUrl)
        setModelHasKey(data.hasApiKey)
      })
      .catch(() => undefined)
  }, [projectId])

  const set = (field: keyof Profile, value: string | string[]) => setForm(current => ({ ...current, [field]: value }))

  const startEditingProfile = () => {
    if (profile) {
      setKeywordsText((profile.keywords ?? []).join(', '))
      setForbiddenText((profile.forbidden ?? []).join(', '))
    }
    setEditing(true)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    if (form.description.trim().length < 10) {
      setError('Description must be at least 10 characters')
      setSaving(false)
      return
    }

    try {
      const payload = {
        ...form,
        keywords: parseCommaList(keywordsText),
        forbidden: parseCommaList(forbiddenText),
      }
      const { data } = await apiFetch<{ data: Profile }>(`/api/projects/${projectId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setProfile(data)
      setForm({
        companyName: data.companyName ?? '',
        description: data.description ?? '',
        niche: data.niche ?? '',
        geography: data.geography ?? '',
        usp: data.usp ?? '',
        keywords: data.keywords ?? [],
        forbidden: data.forbidden ?? [],
        tov: data.tov ?? 'FRIENDLY',
      })
      setKeywordsText((data.keywords ?? []).join(', '))
      setForbiddenText((data.forbidden ?? []).join(', '))
      setEditing(false)
      setSuccess('Profile saved.')
    } catch (err: any) {
      setError(err.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setProjectSaving(true)
    setProjectError('')
    setProjectSuccess('')
    try {
      const { data } = await apiFetch<{ data: Project }>(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description: projectDescription || undefined }),
      })
      setProject(data)
      setProjectSuccess('Project settings saved.')
    } catch (err: any) {
      setProjectError(err.message ?? 'Save failed')
    } finally {
      setProjectSaving(false)
    }
  }

  const handleModelProviderChange = (provider: ModelProvider) => {
    setModelProvider(provider)
    setModelApiUrl(MODEL_OPTIONS.find(option => option.value === provider)?.apiUrl ?? '')
  }

  const handleSaveModelConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setModelSaving(true)
    setModelError('')
    setModelSuccess('')
    try {
      await apiFetch(`/api/projects/${projectId}/model-config`, {
        method: 'PUT',
        body: JSON.stringify({
          provider: modelProvider,
          apiKey: modelApiKey,
          apiUrl: modelApiUrl,
        }),
      })
      setModelApiKey('')
      setModelHasKey(true)
      setModelSuccess('Model API settings saved to .env and applied to new AI requests.')
    } catch (err: any) {
      setModelError(err.message ?? 'Save failed')
    } finally {
      setModelSaving(false)
    }
  }

  const handleDeleteProject = async () => {
    if (deleteConfirm !== project?.name) return
    setDeleting(true)
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      router.push('/dashboard')
    } catch (err: any) {
      setProjectError(err.message ?? 'Delete failed')
      setDeleting(false)
    }
  }

  if (loading) return <p className="muted-text text-sm">Loading...</p>

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Identity and controls</p>
          <h1 className="page-title mt-2">Profile</h1>
        </div>
        <p className="muted-text max-w-xl text-sm">
          Brand profile, project settings, and model provider live in one control center.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-title">Project Profile</h2>
          {profile && !editing && (
            <button onClick={startEditingProfile} className="btn-secondary min-h-10 px-4">
              Edit
            </button>
          )}
        </div>

        {!editing && profile ? (
          <div className="glass-panel p-6">
            {success && <p className="mb-4 text-sm text-emerald-200">{success}</p>}
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Company', profile.companyName],
                ['Description', profile.description],
                ['Niche', profile.niche],
                ['Geography', profile.geography],
                ['USP', profile.usp],
                ['Tone of Voice', profile.tov],
                ['Keywords', profile.keywords?.join(', ')],
                ['Forbidden', profile.forbidden?.join(', ')],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="glass-panel-soft p-4">
                  <dt className="field-label">{label}</dt>
                  <dd className="mt-1 text-sm leading-6 text-zinc-100">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="glass-panel space-y-5 p-6">
            {[
              { label: 'Company Name', field: 'companyName' as const, required: true },
              { label: 'Description', field: 'description' as const, required: true, textarea: true },
              { label: 'Niche', field: 'niche' as const, required: true },
              { label: 'Geography', field: 'geography' as const },
              { label: 'USP', field: 'usp' as const, textarea: true },
            ].map(({ label, field, required, textarea }) => (
              <div key={field}>
                <label className="field-label">
                  {label} {required && <span className="text-rose-300">*</span>}
                </label>
                {textarea ? (
                  <textarea value={(form[field] as string) ?? ''} onChange={e => set(field, e.target.value)}
                    rows={3} required={required}
                    className="field min-h-[120px]" />
                ) : (
                  <input type="text" value={(form[field] as string) ?? ''} onChange={e => set(field, e.target.value)}
                    required={required}
                    className="field" />
                )}
              </div>
            ))}
            <div>
              <label className="field-label">Tone of Voice</label>
              <select value={form.tov ?? 'FRIENDLY'} onChange={e => set('tov', e.target.value)}
                className="field">
                {TOV_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Keywords (comma-separated)</label>
              <input type="text" value={keywordsText}
                onChange={e => setKeywordsText(e.target.value)}
                className="field" />
            </div>
            <div>
              <label className="field-label">Forbidden words (comma-separated)</label>
              <input type="text" value={forbiddenText}
                onChange={e => setForbiddenText(e.target.value)}
                className="field" />
            </div>
            {error && <p className="text-sm text-rose-200">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              {profile && (
                <button type="button" onClick={() => {
                  setKeywordsText((profile.keywords ?? []).join(', '))
                  setForbiddenText((profile.forbidden ?? []).join(', '))
                  setEditing(false)
                }} className="btn-secondary">
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="section-title">Project Settings</h2>
        <form onSubmit={handleSaveProject} className="glass-panel space-y-5 p-6">
          <div>
            <label className="field-label">Project Name <span className="text-rose-300">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="field" />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea value={projectDescription} onChange={e => setProjectDescription(e.target.value)} rows={3}
              className="field min-h-[120px]" />
          </div>
          {projectError && <p className="text-sm text-rose-200">{projectError}</p>}
          {projectSuccess && <p className="text-sm text-emerald-200">{projectSuccess}</p>}
          <button type="submit" disabled={projectSaving} className="btn-primary">
            {projectSaving ? 'Saving...' : 'Save Project'}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="section-title">Model API Settings</h2>
        <form onSubmit={handleSaveModelConfig} className="glass-panel space-y-5 p-6">
          <div>
            <label className="field-label">Model Provider</label>
            <select value={modelProvider} onChange={e => handleModelProviderChange(e.target.value as ModelProvider)}
              className="field">
              {MODEL_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">API URL</label>
            <input type="url" value={modelApiUrl} onChange={e => setModelApiUrl(e.target.value)} required className="field" />
          </div>
          <div>
            <label className="field-label">API Key</label>
            <input type="password" value={modelApiKey} onChange={e => setModelApiKey(e.target.value)} required
              placeholder={modelHasKey ? 'Existing key saved. Enter a new key to replace it.' : 'Paste API key'}
              className="field" />
          </div>
          {modelError && <p className="text-sm text-rose-200">{modelError}</p>}
          {modelSuccess && <p className="text-sm text-emerald-200">{modelSuccess}</p>}
          <button type="submit" disabled={modelSaving} className="btn-primary">
            {modelSaving ? 'Saving...' : 'Save Model Settings'}
          </button>
        </form>
      </section>

      {project && (
        <section className="glass-panel space-y-4 border-rose-300/30 p-6">
          <div>
            <p className="eyebrow text-rose-200">Danger Zone</p>
            <h3 className="section-title mt-1 text-rose-100">Delete Project</h3>
          </div>
          <p className="muted-text text-sm">Type <strong className="text-zinc-100">{project.name}</strong> to confirm deletion. This cannot be undone.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={project.name}
              className="field flex-1" />
            <button
              onClick={handleDeleteProject}
              disabled={deleting || deleteConfirm !== project.name}
              className="btn-danger">
              {deleting ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

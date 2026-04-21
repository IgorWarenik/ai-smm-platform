'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const TOV_OPTIONS = ['FORMAL', 'FRIENDLY', 'EXPERT', 'CASUAL', 'INSPIRATIONAL']

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

export default function ProfilePage() {
  const { id: projectId } = useParams() as { id: string }
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState<Profile>({
    companyName: '', description: '', niche: '',
    geography: '', usp: '', keywords: [], forbidden: [], tov: 'FRIENDLY',
  })

  useEffect(() => {
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
      })
      .catch((err) => { if (err.status === 404) setEditing(true) })
      .finally(() => setLoading(false))
  }, [projectId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const { data } = await apiFetch<{ data: Profile }>(`/api/projects/${projectId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      setProfile(data)
      setEditing(false)
      setSuccess('Profile saved.')
    } catch (err: any) {
      setError(err.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const set = (field: keyof Profile, value: any) => setForm(f => ({ ...f, [field]: value }))

  if (loading) return <p className="text-gray-500">Loading...</p>

  if (!editing && profile) {
    return (
      <div className="max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Project Profile</h2>
          <button onClick={() => setEditing(true)}
            className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50">Edit</button>
        </div>
        {success && <p className="text-sm text-green-600 mb-3">{success}</p>}
        <dl className="space-y-3">
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
            <div key={label as string}>
              <dt className="text-xs font-medium text-gray-500 uppercase">{label}</dt>
              <dd className="text-sm mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-4">{profile ? 'Edit Profile' : 'Create Profile'}</h2>
      <form onSubmit={handleSave} className="space-y-4 bg-white border rounded-lg p-6">
        {[
          { label: 'Company Name', field: 'companyName' as const, required: true },
          { label: 'Description', field: 'description' as const, required: true, textarea: true },
          { label: 'Niche', field: 'niche' as const, required: true },
          { label: 'Geography', field: 'geography' as const },
          { label: 'USP', field: 'usp' as const, textarea: true },
        ].map(({ label, field, required, textarea }) => (
          <div key={field}>
            <label className="block text-sm font-medium mb-1">
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            {textarea ? (
              <textarea value={(form[field] as string) ?? ''} onChange={e => set(field, e.target.value)}
                rows={3} required={required}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ) : (
              <input type="text" value={(form[field] as string) ?? ''} onChange={e => set(field, e.target.value)}
                required={required}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium mb-1">Tone of Voice</label>
          <select value={form.tov ?? 'FRIENDLY'} onChange={e => set('tov', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {TOV_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Keywords (comma-separated)</label>
          <input type="text" value={(form.keywords ?? []).join(', ')}
            onChange={e => set('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Forbidden words (comma-separated)</label>
          <input type="text" value={(form.forbidden ?? []).join(', ')}
            onChange={e => set('forbidden', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          {profile && (
            <button type="button" onClick={() => setEditing(false)}
              className="border px-4 py-2 rounded text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

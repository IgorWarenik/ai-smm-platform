'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'
import { useLang } from '@/contexts/lang'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const { t } = useLang()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password, name)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message ?? t('auth.register.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shell-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="hero-orb left-[-90px] top-[10%] h-[220px] w-[220px] bg-[#A9C0DA]" />
      <div className="hero-orb bottom-[10%] right-[-80px] h-[250px] w-[250px] bg-[#F4BA96]" />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-border bg-card shadow-[0_30px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[0.88fr_1.12fr]">
        <div className="px-6 py-8 sm:px-10 sm:py-12">
          <div className="mb-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
              AI
            </div>
            <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-foreground">{t('auth.register.title')}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('auth.register.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('auth.register.name')}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                className="w-full rounded-2xl border border-input bg-background/80 px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-input bg-background/80 px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('auth.login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-2xl border border-input bg-background/80 px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring/30"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? t('auth.register.submitting') : t('auth.register.submit')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.register.hasAccount')}{' '}
            <Link href="/login" className="font-medium text-foreground hover:underline">
              {t('auth.register.login')}
            </Link>
          </p>
        </div>

        <div className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#1d3048_0%,#284866_46%,#b35d33_155%)] px-10 py-12 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/85">
              Team Workflow
            </div>

            <h2 className="mt-10 max-w-md text-5xl font-semibold leading-[1.05] tracking-[-0.04em]">
              {t('auth.hero.title')}
            </h2>
            <div className="mt-10 grid gap-3">
              {(['auth.hero.feature1', 'auth.hero.feature2', 'auth.hero.feature3'] as const).map((key) => (
                <div key={key} className="rounded-2xl border border-white/14 bg-white/10 px-4 py-3 text-sm text-white/86 backdrop-blur-sm">
                  {t(key)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

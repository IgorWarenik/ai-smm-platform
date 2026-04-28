'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      const returnTo = searchParams.get('returnTo')
      router.push(returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <div className="mb-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
          AI
        </div>
        <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-foreground">Войти в платформу</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Продолжите работу с проектами, задачами и контентом команды.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full rounded-2xl border border-input bg-background/80 px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full rounded-2xl border border-input bg-background/80 px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Нет аккаунта?{' '}
        <Link href="/register" className="font-medium text-foreground hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="hero-orb left-[-80px] top-[8%] h-[220px] w-[220px] bg-[#F4BA96]" />
      <div className="hero-orb bottom-[6%] right-[-70px] h-[260px] w-[260px] bg-[#A9C0DA]" />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-border bg-card shadow-[0_30px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#17304c_0%,#244d70_52%,#d97948_160%)] px-10 py-12 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/85">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#17304c] font-bold">AI</span>
              Marketing Studio
            </div>

            <h1 className="mt-10 max-w-md text-5xl font-semibold leading-[1.05] tracking-[-0.04em]">
              Контент, задачи и согласование в одной рабочей системе.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/78">
              Управляйте маркетинговым продакшеном, запускайте AI-задачи и держите под рукой календарь, библиотеку и проектный контекст.
            </p>

            <div className="mt-10 grid gap-3">
              {[
                'Единый контур задач, материалов и ревью',
                'AI-исполнители с понятными статусами',
                'Рабочий ритм команды без ручного хаоса',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/14 bg-white/10 px-4 py-3 text-sm text-white/86 backdrop-blur-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Suspense fallback={<div className="px-6 py-8 sm:px-10 sm:py-12" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}

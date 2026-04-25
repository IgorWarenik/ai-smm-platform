'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
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
      setError(err.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-page flex items-center justify-center px-4 py-10">
      <div className="glass-panel w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <p className="eyebrow">Launch access</p>
          <h1 className="mt-2 text-4xl font-bold">Create Account</h1>
          <p className="muted-text mt-2 text-sm">Build campaign systems with AI agents.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="field" />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="field" />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className="field" />
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button type="submit" disabled={loading}
            className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Register'}
          </button>
          <p className="muted-text text-center text-sm">
            Have an account?{' '}
            <Link href="/login" className="font-bold text-cyan-200 hover:text-white">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

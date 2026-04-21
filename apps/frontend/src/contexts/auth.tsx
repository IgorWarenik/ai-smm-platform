'use client'
import { apiFetch, clearTokens, getAccessToken, loadTokensFromStorage, setTokens } from '@/lib/api';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type User = { id: string; email: string; name: string }
type AuthCtx = {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, name: string) => Promise<void>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadTokensFromStorage()
        if (getAccessToken()) {
            apiFetch<{ data: User }>('/api/auth/me')
                .then(({ data }) => setUser(data))
                .catch(() => clearTokens())
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [])

    const login = useCallback(async (email: string, password: string) => {
        const { data } = await apiFetch<any>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        })
        setTokens(data.tokens.accessToken, data.tokens.refreshToken)
        setUser(data.user)
    }, [])

    const register = useCallback(async (email: string, password: string, name: string) => {
        const { data } = await apiFetch<any>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        })
        setTokens(data.tokens.accessToken, data.tokens.refreshToken)
        setUser(data.user)
    }, [])

    const logout = useCallback(async () => {
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
        if (refreshToken) {
            await apiFetch('/api/auth/logout', {
                method: 'POST',
                body: JSON.stringify({ refreshToken }),
            }).catch(() => { })
        }
        clearTokens()
        setUser(null)
    }, [])

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
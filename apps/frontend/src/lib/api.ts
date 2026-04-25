const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

let accessToken: string | null = null
let refreshToken: string | null = null

export function setTokens(access: string, refresh: string) {
    accessToken = access
    refreshToken = refresh
    if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        document.cookie = `access_token=${access}; path=/; max-age=900; SameSite=Lax`
    }
}

export function loadTokensFromStorage() {
    if (typeof window !== 'undefined') {
        accessToken = localStorage.getItem('access_token')
        refreshToken = localStorage.getItem('refresh_token')
    }
}

export function clearTokens() {
    accessToken = null
    refreshToken = null
    if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        document.cookie = 'access_token=; path=/; max-age=0'
    }
}

export function getAccessToken() { return accessToken }
export function getRefreshToken() { return refreshToken }

async function refreshAccessToken(): Promise<boolean> {
    if (!refreshToken) return false
    try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        })
        if (!res.ok) { clearTokens(); return false }
        const { data } = await res.json()
        setTokens(data.tokens.accessToken, data.tokens.refreshToken)
        return true
    } catch {
        clearTokens()
        return false
    }
}

export async function apiFetch<T = unknown>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    loadTokensFromStorage()

    const makeRequest = (token: string | null) =>
        fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        })

    let res = await makeRequest(accessToken)

    if (res.status === 401 && refreshToken) {
        const ok = await refreshAccessToken()
        if (ok) res = await makeRequest(accessToken)
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }))
        const message = error.message ?? error.error ?? 'Request failed'
        throw Object.assign(new Error(message), {
            status: res.status,
            code: error.code,
            details: error.details,
        })
    }

    if (res.status === 204) return undefined as T
    return res.json()
}

'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function ProjectError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => { console.error(error) }, [error])

    return (
        <div className="glass-panel p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold text-rose-200">Something went wrong</h2>
            <p className="muted-text mb-4 text-sm">{error.message}</p>
            <div className="flex gap-3 justify-center">
                <button onClick={reset} className="btn-secondary">
                    Try again
                </button>
                <Link href="/dashboard" className="btn-primary">
                    Back to Dashboard
                </Link>
            </div>
        </div>
    )
}

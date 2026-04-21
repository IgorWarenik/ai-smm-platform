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
        <div className="p-6 text-center">
            <h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-4">{error.message}</p>
            <div className="flex gap-3 justify-center">
                <button onClick={reset} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
                    Try again
                </button>
                <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                    Back to Dashboard
                </Link>
            </div>
        </div>
    )
}

'use client'
import { useEffect } from 'react'

type ToastProps = {
    message: string
    type: 'success' | 'error'
    onDismiss: () => void
}

export default function Toast({ message, type, onDismiss }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3000)
        return () => clearTimeout(timer)
    }, [onDismiss])

    return (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur transition-all ${type === 'success'
            ? 'border-emerald-300/30 bg-emerald-500/20 text-emerald-100'
            : 'border-rose-300/30 bg-rose-500/20 text-rose-100'
            }`}>
            {message}
        </div>
    )
}

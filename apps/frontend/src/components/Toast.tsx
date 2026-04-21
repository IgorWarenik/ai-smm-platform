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
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
            type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
            {message}
        </div>
    )
}

'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ProjectSettingsRedirectPage() {
    const { id } = useParams() as { id: string }
    const router = useRouter()

    useEffect(() => {
        router.replace(`/projects/${id}/profile`)
    }, [id, router])

    return <p className="muted-text text-sm">Opening profile...</p>
}

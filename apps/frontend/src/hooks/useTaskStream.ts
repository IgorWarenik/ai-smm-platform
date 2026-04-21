import { getAccessToken } from '@/lib/api';
import { useEffect, useState } from 'react';

type StreamEvent = { type: string; agentType?: string; content?: string; error?: string }

export function useTaskStream(
    projectId: string,
    taskId: string,
    enabled: boolean
): StreamEvent[] {
    const [events, setEvents] = useState<StreamEvent[]>([])

    useEffect(() => {
        if (!enabled || !taskId) return
        setEvents([])

        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
        const token = getAccessToken()
        const url = `${API_BASE}/api/projects/${projectId}/tasks/${taskId}/stream`

        // Pass token as query param (EventSource doesn't support headers)
        const es = new EventSource(`${url}?token=${token ?? ''}`)

        es.onmessage = (e) => {
            try {
                const data: StreamEvent = JSON.parse(e.data)
                setEvents((prev) => [...prev, data])
            } catch { }
        }

        es.onerror = () => es.close()

        return () => es.close()
    }, [projectId, taskId, enabled])

    return events
}
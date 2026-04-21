'use client'
import { apiFetch } from '@/lib/api'
import { useState } from 'react'

type Props = {
    projectId: string
    taskId: string
    agentOutputs?: Array<{ agentType: string; content: string }>
    onDecision: (result: any) => void
}

export default function ApprovalPanel({ projectId, taskId, agentOutputs, onDecision }: Props) {
    const [comment, setComment] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const submit = async (decision: 'APPROVED' | 'REVISION_REQUESTED') => {
        if (decision === 'REVISION_REQUESTED' && comment.trim().length < 50) {
            setError('Revision feedback must be at least 50 characters')
            return
        }
        setLoading(true)
        setError('')
        try {
            const result = await apiFetch<any>(
                `/api/projects/${projectId}/tasks/${taskId}/approvals`,
                { method: 'POST', body: JSON.stringify({ decision, comment: comment || undefined }) }
            )
            onDecision(result)
        } catch (err: any) {
            setError(err.message ?? 'Failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="border rounded-lg p-4 bg-purple-50 space-y-4">
            <h3 className="font-semibold">Review Output</h3>

            {agentOutputs && agentOutputs.length > 0 && (
                <div className="space-y-2">
                    {agentOutputs.map((o, i) => (
                        <div key={i} className="bg-white border rounded p-3">
                            <p className="text-xs font-medium text-gray-500 mb-1">{o.agentType}</p>
                            <p className="text-sm whitespace-pre-wrap">{o.content}</p>
                        </div>
                    ))}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-1">
                    Feedback (required for Revision Request, min 50 chars)
                </label>
                <textarea
                    value={comment}
                    onChange={e => { setComment(e.target.value); setError('') }}
                    rows={3}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Describe what needs to be changed..."
                />
                <p className="text-xs text-gray-400">{comment.trim().length}/50 min</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
                <button onClick={() => submit('APPROVED')} disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    Approve
                </button>
                <button onClick={() => submit('REVISION_REQUESTED')} disabled={loading}
                    className="bg-orange-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    Request Revision
                </button>
            </div>
        </div>
    )
}
'use client'
import ApprovalPanel from '@/components/ApprovalPanel'
import { useTaskStream } from '@/hooks/useTaskStream'
import { apiFetch } from '@/lib/api'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Task = {
    id: string
    input: string
    status: string
    score?: number
    scenario?: string
    clarificationNote?: string
    createdAt: string
    executions?: any[]
}

export default function ProjectTasksPage() {
    const { id: projectId } = useParams() as { id: string }
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('ALL')

    // Creation form state
    const [input, setInput] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [creationError, setCreationError] = useState<any>(null)
    const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
    const [clarificationTaskId, setClarificationTaskId] = useState<string | null>(null)

    const selectedTask = tasks.find(t => t.id === selectedTaskId)
    const streamEnabled = selectedTask?.status === 'RUNNING'
    const streamEvents = useTaskStream(projectId, selectedTaskId || '', streamEnabled)

    const fetchTasks = () => {
        const qs = statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''
        apiFetch<{ data: Task[] }>(`/api/projects/${projectId}/tasks?pageSize=20${qs}`)
            .then(({ data }) => setTasks(data))
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchTasks() }, [projectId, statusFilter])

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setCreationError(null)
        setClarificationQuestions([])

        try {
            const res: any = await apiFetch(`/api/projects/${projectId}/tasks`, {
                method: 'POST',
                body: JSON.stringify({ input })
            })
            if (res.clarificationQuestions) {
                setClarificationQuestions(res.clarificationQuestions)
                setClarificationTaskId(res.data.id)
            } else {
                setInput('')
                fetchTasks()
            }
        } catch (err: any) {
            setCreationError(err)
        } finally {
            setSubmitting(false)
        }
    }

    const handleExecute = async (tid: string) => {
        await apiFetch(`/api/projects/${projectId}/tasks/${tid}/execute`, { method: 'POST' })
        fetchTasks()
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-4 border rounded-lg shadow-sm">
                    <h2 className="font-semibold mb-3">New Task</h2>
                    <form onSubmit={handleCreateTask} className="space-y-3">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Describe your task..."
                            className="w-full border rounded p-2 text-sm min-h-[100px]"
                            required
                        />
                        {creationError && (
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                {creationError.message}
                                {creationError.details && <p>Score: {creationError.details.score}</p>}
                            </div>
                        )}
                        <button type="submit" disabled={submitting}
                            className="w-full bg-blue-600 text-white py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                            {submitting ? 'Creating...' : 'Create Task'}
                        </button>
                    </form>

                    {clarificationQuestions.length > 0 && clarificationTaskId && (
                        <div className="mt-4">
                            <ClarificationForm
                                questions={clarificationQuestions}
                                taskId={clarificationTaskId}
                                projectId={projectId}
                                onDone={() => {
                                    setClarificationQuestions([])
                                    setInput('')
                                    fetchTasks()
                                }}
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <h2 className="font-semibold">Recent Tasks</h2>
                    <div className="flex flex-wrap gap-1">
                        {['ALL','PENDING','IN_PROGRESS','AWAITING_APPROVAL','APPROVED','REVISION_REQUESTED','COMPLETED','FAILED'].map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)}
                                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50 border-gray-200'}`}>
                                {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                    {loading ? <p className="text-sm text-gray-400">Loading...</p> : tasks.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setSelectedTaskId(t.id)}
                            className={`w-full text-left p-3 border rounded-lg text-sm transition-colors ${selectedTaskId === t.id ? 'border-blue-600 bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${getStatusColor(t.status)}`}>
                                    {t.status}
                                </span>
                                <span className="text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="line-clamp-2 text-gray-700">{t.input}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="md:col-span-2">
                {selectedTask ? (
                    <div className="bg-white border rounded-lg shadow-sm p-6 space-y-6">
                        <div className="flex justify-between items-start">
                            <h1 className="text-xl font-bold">Task Detail</h1>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Quality Score</p>
                                <p className="text-2xl font-black text-blue-600">{selectedTask.score ?? 'N/A'}</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap text-gray-800 border">
                            {selectedTask.input}
                        </div>

                        {selectedTask.status === 'AWAITING_CLARIFICATION' && (
                            <ClarificationForm
                                questions={selectedTask.clarificationNote?.split('\n') ?? []}
                                taskId={selectedTask.id}
                                projectId={projectId}
                                onDone={fetchTasks}
                            />
                        )}

                        {selectedTask.status === 'PENDING' && (
                            <button onClick={() => handleExecute(selectedTask.id)}
                                className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700">
                                Execute Workflow (Scenario {selectedTask.scenario})
                            </button>
                        )}

                        {selectedTask.status === 'RUNNING' && (
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                    Live Agent Output
                                </h3>
                                <div className="space-y-3">
                                    {streamEvents.map((ev, i) => (
                                        <div key={i} className="text-sm border-l-2 border-blue-200 pl-4 py-1">
                                            {ev.agentType && <span className="font-bold text-xs text-blue-600 block uppercase">{ev.agentType}</span>}
                                            <p className="text-gray-700">{ev.content}</p>
                                            {ev.error && <p className="text-red-600">{ev.error}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedTask.status === 'AWAITING_APPROVAL' && (
                            <ApprovalPanel
                                projectId={projectId}
                                taskId={selectedTask.id}
                                agentOutputs={selectedTask.executions?.[0]?.agentOutputs?.map((o: any) => ({ agentType: o.agentType, content: o.output }))}
                                onDecision={() => fetchTasks()}
                            />
                        )}

                        {selectedTask.status === 'COMPLETED' && selectedTask.executions?.[0]?.agentOutputs && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-green-700">Final Results</h3>
                                {selectedTask.executions[0].agentOutputs.map((o: any, i: number) => (
                                    <div key={i} className="border rounded p-4">
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">{o.agentType}</p>
                                        <div className="text-sm prose max-w-none whitespace-pre-wrap">{o.output}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg text-gray-400">
                        Select a task to view details
                    </div>
                )}
            </div>
        </div>
    )
}

function ClarificationForm({ questions, taskId, projectId, onDone }: { questions: string[], taskId: string, projectId: string, onDone: (t?: any) => void }) {
    const [answer, setAnswer] = useState('')
    const [loading, setLoading] = useState(false)
    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await apiFetch<any>(`/api/projects/${projectId}/tasks/${taskId}/clarify`, {
                method: 'POST',
                body: JSON.stringify({ answer })
            })
            onDone(res.data)
        } finally {
            setLoading(false)
        }
    }
    return (
        <form onSubmit={submit} className="bg-orange-50 border border-orange-200 p-4 rounded-lg space-y-3">
            <p className="text-sm font-semibold text-orange-800">The AI needs more information:</p>
            <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                {questions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} required placeholder="Provide clarification here..."
                className="w-full border border-orange-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" rows={4} />
            <button type="submit" disabled={loading}
                className="bg-orange-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                {loading ? 'Submitting...' : 'Submit Clarification'}
            </button>
        </form>
    )
}

function getStatusColor(s: string) {
    const map: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-800', RUNNING: 'bg-blue-100 text-blue-800', AWAITING_APPROVAL: 'bg-purple-100 text-purple-800', AWAITING_CLARIFICATION: 'bg-orange-100 text-orange-800', COMPLETED: 'bg-green-100 text-green-800', REJECTED: 'bg-red-100 text-red-800', QUEUED: 'bg-gray-100 text-gray-800' }
    return map[s] || 'bg-gray-100 text-gray-600'
}
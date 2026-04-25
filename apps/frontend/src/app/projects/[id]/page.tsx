'use client'
import ApprovalPanel from '@/components/ApprovalPanel'
import Toast from '@/components/Toast'
import { useTaskStream } from '@/hooks/useTaskStream'
import { apiFetch } from '@/lib/api'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Task = {
    id: string
    input: string
    status: string
    scenario?: string
    clarificationNote?: string
    createdAt: string
    executions?: any[]
}

const TASK_NEEDS_MORE_DETAIL_MESSAGE = 'Not enough input. Please describe the task in more detail.'

function hasAgentOutputs(task: Task) {
    return Boolean(task.executions?.some((execution: any) => execution.agentOutputs?.length))
}

function mergeTaskData(existing: Task | undefined, incoming: Task): Task {
    if (!existing) return incoming
    const keepExistingOutputs = hasAgentOutputs(existing) && !hasAgentOutputs(incoming)
    return {
        ...existing,
        ...incoming,
        executions: keepExistingOutputs ? existing.executions : incoming.executions ?? existing.executions,
    }
}

export default function ProjectTasksPage() {
    const { id: projectId } = useParams() as { id: string }
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('ALL')

    const [input, setInput] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [creationError, setCreationError] = useState<any>(null)
    const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
    const [clarificationTaskId, setClarificationTaskId] = useState<string | null>(null)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [editingInput, setEditingInput] = useState(false)
    const [editInputValue, setEditInputValue] = useState('')

    const selectedTask = tasks.find(t => t.id === selectedTaskId)
    const streamEnabled = selectedTask?.status === 'RUNNING'
    const streamEvents = useTaskStream(projectId, selectedTaskId || '', streamEnabled)

    const mergeTask = (task: Task) => {
        setTasks(prev => prev.some(t => t.id === task.id)
            ? prev.map(t => t.id === task.id ? mergeTaskData(t, task) : t)
            : [task, ...prev]
        )
    }

    const mergeTaskList = (nextTasks: Task[]) => {
        setTasks(prev => nextTasks.map(task => mergeTaskData(prev.find(t => t.id === task.id), task)))
    }

    const fetchTasks = () => {
        const qs = statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''
        apiFetch<{ data: Task[] }>(`/api/projects/${projectId}/tasks?pageSize=20${qs}`)
            .then(({ data }) => mergeTaskList(data))
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchTasks() }, [projectId, statusFilter])

    useEffect(() => {
        if (!tasks.some(t => ['QUEUED', 'PENDING', 'RUNNING'].includes(t.status))) return
        const timer = window.setInterval(fetchTasks, 2000)
        return () => window.clearInterval(timer)
    }, [projectId, statusFilter, tasks])

    useEffect(() => {
        if (!selectedTaskId) return
        apiFetch<{ data: Task }>(`/api/projects/${projectId}/tasks/${selectedTaskId}`)
            .then(({ data }) => mergeTask(data))
            .catch(() => { })
    }, [projectId, selectedTaskId])

    useEffect(() => {
        if (!selectedTaskId) return
        const last = streamEvents[streamEvents.length - 1]
        if (!last || (last.type !== 'execution.completed' && last.type !== 'execution.failed')) return
        apiFetch<{ data: Task }>(`/api/projects/${projectId}/tasks/${selectedTaskId}`)
            .then(({ data }) => mergeTask(data))
            .catch(() => { })
    }, [projectId, selectedTaskId, streamEvents])

    useEffect(() => {
        if (!selectedTaskId || selectedTask?.status !== 'AWAITING_APPROVAL') return
        if (selectedTask.executions?.[0]?.agentOutputs?.length) return
        apiFetch<{ data: Task }>(`/api/projects/${projectId}/tasks/${selectedTaskId}`)
            .then(({ data }) => mergeTask(data))
            .catch(() => { })
    }, [projectId, selectedTaskId, selectedTask?.status])

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
                setSelectedTaskId(res.data.id)
                mergeTask(res.data)
                fetchTasks()
                setToast({
                    message: res.workflowStartError?.message ?? res.workflowStartError?.error ?? 'Task started',
                    type: res.workflowStartError ? 'error' : 'success'
                })
            }
        } catch (err: any) {
            setCreationError(err)
            const message = err?.code === 'TASK_SCORE_TOO_LOW'
                ? TASK_NEEDS_MORE_DETAIL_MESSAGE
                : err?.message ?? 'Failed to create task'
            setToast({ message, type: 'error' })
        } finally {
            setSubmitting(false)
        }
    }

    const handleSaveInput = async () => {
        if (!selectedTask) return
        try {
            await apiFetch(`/api/projects/${projectId}/tasks/${selectedTask.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ input: editInputValue }),
            })
            setEditingInput(false)
            fetchTasks()
            setToast({ message: 'Task updated', type: 'success' })
        } catch (err: any) {
            setToast({ message: err?.message ?? 'Failed to update task', type: 'error' })
        }
    }

    const handleDeleteTask = async (tid: string) => {
        if (!confirm('Delete this task?')) return
        try {
            await apiFetch(`/api/projects/${projectId}/tasks/${tid}`, { method: 'DELETE' })
            setSelectedTaskId(prev => prev === tid ? null : prev)
            fetchTasks()
            setToast({ message: 'Task deleted', type: 'success' })
        } catch {
            setToast({ message: 'Failed to delete task', type: 'error' })
        }
    }

    return (
        <>
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="eyebrow">Mission control</p>
                    <h1 className="page-title mt-2">Tasks</h1>
                </div>
                <p className="muted-text max-w-xl text-sm">
                    Create, review, and launch AI marketing work from one command surface.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
                <div className="space-y-6">
                    <div className="glass-panel p-5">
                        <h2 className="section-title mb-4">New Task</h2>
                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Describe the campaign, channel, and result you need..."
                                className="field min-h-[150px] resize-y"
                                required
                            />
                            {creationError && (
                                <div className="glass-panel-soft p-3 text-sm text-rose-200">
                                    {creationError.code === 'TASK_SCORE_TOO_LOW'
                                        ? TASK_NEEDS_MORE_DETAIL_MESSAGE
                                        : creationError.message}
                                </div>
                            )}
                            <button type="submit" disabled={submitting} className="btn-primary w-full">
                                {submitting ? 'Creating...' : 'Create Task'}
                            </button>
                        </form>

                        {clarificationQuestions.length > 0 && clarificationTaskId && (
                            <div className="mt-5">
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

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="section-title">Recent Tasks</h2>
                            <span className="muted-text text-xs">{tasks.length} loaded</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {['ALL', 'QUEUED', 'PENDING', 'RUNNING', 'AWAITING_CLARIFICATION', 'AWAITING_APPROVAL', 'APPROVED', 'REVISION_REQUESTED', 'COMPLETED', 'FAILED'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`status-pill ${statusFilter === s ? 'nav-link-active' : ''}`}
                                >
                                    {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                        {!loading && tasks.length === 0 && (
                            <div className="glass-panel-soft py-10 text-center">
                                <p className="text-sm font-semibold text-white">No tasks yet</p>
                                <p className="muted-text mt-1 text-xs">
                                    {statusFilter === 'ALL' ? 'Create your first task above' : `No tasks with status "${statusFilter.replace(/_/g, ' ')}"`}
                                </p>
                            </div>
                        )}
                        {loading ? <p className="muted-text text-sm">Loading...</p> : tasks.map(t => (
                            <div key={t.id} className="group relative">
                                <button
                                    onClick={() => setSelectedTaskId(t.id)}
                                    className={`w-full rounded-lg border p-4 text-left text-sm transition-colors ${selectedTaskId === t.id
                                        ? 'border-indigo-300/60 bg-indigo-950/40'
                                        : 'border-white/10 bg-white/[0.045] hover:border-indigo-300/40 hover:bg-white/[0.075]'
                                        }`}
                                >
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <span className={`status-pill ${getStatusColor(t.status)}`}>
                                            {t.status}
                                        </span>
                                        <span className="muted-text shrink-0 text-[11px]">{new Date(t.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="line-clamp-2 text-zinc-200">{t.input}</p>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id) }}
                                    className="absolute right-3 top-3 hidden h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm text-zinc-400 hover:border-rose-300/40 hover:text-rose-200 group-hover:flex"
                                    title="Delete task"
                                >x</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    {selectedTask ? (
                        <div className="glass-panel space-y-6 p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="eyebrow">Selected task</p>
                                    <h2 className="section-title mt-1">Task Detail</h2>
                                </div>
                            </div>

                            {editingInput ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={editInputValue}
                                        onChange={e => setEditInputValue(e.target.value)}
                                        className="field min-h-[150px]"
                                    />
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={handleSaveInput} className="btn-primary">
                                            Save
                                        </button>
                                        <button onClick={() => setEditingInput(false)} className="btn-secondary">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="group/input relative">
                                    <div className="glass-panel-soft p-4 text-sm leading-6 text-zinc-100 whitespace-pre-wrap">
                                        {selectedTask.input}
                                    </div>
                                    {(selectedTask.status === 'PENDING' || selectedTask.status === 'REJECTED') && (
                                        <button
                                            onClick={() => { setEditInputValue(selectedTask.input); setEditingInput(true) }}
                                            className="btn-secondary absolute right-3 top-3 hidden min-h-8 px-3 text-xs group-hover/input:inline-flex"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                            )}

                            {selectedTask.status === 'AWAITING_CLARIFICATION' && (
                                <ClarificationForm
                                    questions={selectedTask.clarificationNote?.split('\n') ?? []}
                                    taskId={selectedTask.id}
                                    projectId={projectId}
                                    onDone={fetchTasks}
                                />
                            )}

                            {selectedTask.status === 'REJECTED' && (
                                <div className="glass-panel-soft border border-rose-300/20 p-4 text-sm text-rose-100">
                                    {TASK_NEEDS_MORE_DETAIL_MESSAGE}
                                </div>
                            )}

                            {selectedTask.status === 'RUNNING' && (
                                <div className="space-y-4">
                                    <h3 className="section-title flex items-center gap-3 text-base">
                                        <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)] animate-pulse" />
                                        Live Agent Output
                                    </h3>
                                    <div className="space-y-3">
                                        {streamEvents.map((ev, i) => (
                                            <div key={i} className="border-l border-indigo-300/40 py-2 pl-4 text-sm">
                                                {ev.agentType && <span className="eyebrow block">{ev.agentType}</span>}
                                                <p className="text-zinc-200">{ev.content}</p>
                                                {ev.error && <p className="text-rose-200">{ev.error}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedTask.status === 'AWAITING_APPROVAL' && (
                                <ApprovalPanel
                                    projectId={projectId}
                                    taskId={selectedTask.id}
                                    agentOutputs={selectedTask.executions?.[0]?.agentOutputs?.map((o: any) => ({ agentType: o.agentType, content: o.output })) ?? []}
                                    onDecision={() => fetchTasks()}
                                />
                            )}

                            {selectedTask.status === 'COMPLETED' && selectedTask.executions?.[0]?.agentOutputs && (
                                <div className="space-y-4">
                                    <h3 className="section-title text-emerald-200">Final Results</h3>
                                    {selectedTask.executions[0].agentOutputs.map((o: any, i: number) => (
                                        <div key={i} className="glass-panel-soft p-4">
                                            <p className="eyebrow mb-2">{o.agentType}</p>
                                            <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-100">{o.output}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="glass-panel-soft flex min-h-[420px] items-center justify-center p-8 text-center">
                            <p className="muted-text text-sm">Select a task to view details</p>
                        </div>
                    )}
                </div>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </>
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
        <form onSubmit={submit} className="glass-panel-soft space-y-4 p-4">
            <p className="text-sm font-semibold text-amber-200">{TASK_NEEDS_MORE_DETAIL_MESSAGE}</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-amber-100/90">
                {questions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} required placeholder="Provide clarification here..."
                className="field min-h-[120px]" rows={4} />
            <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Submitting...' : 'Submit Clarification'}
            </button>
        </form>
    )
}

function getStatusColor(s: string) {
    const map: Record<string, string> = {
        PENDING: 'status-pending',
        QUEUED: 'status-pending',
        IN_PROGRESS: 'status-running',
        RUNNING: 'status-running',
        AWAITING_APPROVAL: 'status-awaiting-approval',
        AWAITING_CLARIFICATION: 'status-awaiting-clarification',
        APPROVED: 'status-completed',
        REVISION_REQUESTED: 'status-pending',
        COMPLETED: 'status-completed',
        REJECTED: 'status-rejected',
        FAILED: 'status-failed',
    }
    return map[s] || ''
}

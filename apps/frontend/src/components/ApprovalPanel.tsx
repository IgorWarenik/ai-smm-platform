'use client'
import { apiFetch } from '@/lib/api'
import { useState, type ReactNode } from 'react'

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
    const hasOutput = Boolean(agentOutputs?.length)

    const submit = async (decision: 'APPROVED' | 'REVISION_REQUESTED') => {
        if (!hasOutput) {
            setError('Output is not loaded yet')
            return
        }
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
        <div className="glass-panel-soft space-y-4 p-5">
            <h3 className="section-title text-base">Review Output</h3>

            {hasOutput ? (
                <div className="space-y-3">
                    {agentOutputs?.map((o, i) => (
                        <div key={i} className="glass-panel-soft p-4">
                            <p className="eyebrow mb-2">{o.agentType}</p>
                            <MarkdownContent content={o.content} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-panel-soft p-4 text-sm muted-text">
                    Output is loading...
                </div>
            )}

            <div>
                <label className="field-label">
                    Feedback (required for Revision Request, min 50 chars)
                </label>
                <textarea
                    value={comment}
                    onChange={e => { setComment(e.target.value); setError('') }}
                    rows={3}
                    className="field min-h-[110px]"
                    placeholder="Describe what needs to be changed..."
                />
                <p className="muted-text mt-1 text-xs">{comment.trim().length}/50 min</p>
            </div>

            {error && <p className="text-sm text-rose-200">{error}</p>}

            <div className="flex flex-wrap gap-3">
                <button onClick={() => submit('APPROVED')} disabled={loading || !hasOutput}
                    className="btn-primary">
                    Approve
                </button>
                <button onClick={() => submit('REVISION_REQUESTED')} disabled={loading || !hasOutput}
                    className="btn-secondary">
                    Request Revision
                </button>
            </div>
        </div>
    )
}

function MarkdownContent({ content }: { content: string }) {
    const lines = content.replace(/\r\n/g, '\n').split('\n')
    const blocks: ReactNode[] = []
    let index = 0

    while (index < lines.length) {
        const line = lines[index]

        if (!line.trim()) {
            index += 1
            continue
        }

        if (line.trim().startsWith('```')) {
            const code: string[] = []
            index += 1
            while (index < lines.length && !lines[index].trim().startsWith('```')) {
                code.push(lines[index])
                index += 1
            }
            index += index < lines.length ? 1 : 0
            blocks.push(
                <pre key={blocks.length} className="overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 text-xs leading-5 text-cyan-100">
                    <code>{code.join('\n')}</code>
                </pre>
            )
            continue
        }

        const heading = line.match(/^(#{1,4})\s+(.+)$/)
        if (heading) {
            const level = heading[1].length
            const className = level === 1
                ? 'text-xl font-bold text-white'
                : level === 2
                    ? 'text-lg font-bold text-white'
                    : 'text-base font-semibold text-zinc-100'
            const Tag = (`h${Math.min(level, 4)}`) as keyof JSX.IntrinsicElements
            blocks.push(<Tag key={blocks.length} className={className}>{renderInline(heading[2])}</Tag>)
            index += 1
            continue
        }

        if (isTableStart(lines, index)) {
            const header = splitTableRow(lines[index])
            index += 2
            const rows: string[][] = []
            while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                rows.push(splitTableRow(lines[index]))
                index += 1
            }
            blocks.push(
                <div key={blocks.length} className="overflow-x-auto rounded-md border border-white/10">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead className="bg-white/[0.06] text-zinc-100">
                            <tr>
                                {header.map((cell, cellIndex) => (
                                    <th key={cellIndex} className="border-b border-white/10 px-3 py-2 font-semibold">
                                        {renderInline(cell)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="align-top">
                                    {header.map((_, cellIndex) => (
                                        <td key={cellIndex} className="px-3 py-2 text-zinc-200">
                                            {renderInline(row[cellIndex] ?? '')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
            continue
        }

        if (/^\s*[-*]\s+/.test(line)) {
            const items: string[] = []
            while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*[-*]\s+/, ''))
                index += 1
            }
            blocks.push(
                <ul key={blocks.length} className="list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-100">
                    {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
                </ul>
            )
            continue
        }

        if (/^\s*\d+\.\s+/.test(line)) {
            const items: string[] = []
            while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*\d+\.\s+/, ''))
                index += 1
            }
            blocks.push(
                <ol key={blocks.length} className="list-decimal space-y-1 pl-5 text-sm leading-6 text-zinc-100">
                    {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
                </ol>
            )
            continue
        }

        if (/^\s*>\s?/.test(line)) {
            const quote: string[] = []
            while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
                quote.push(lines[index].replace(/^\s*>\s?/, ''))
                index += 1
            }
            blocks.push(
                <blockquote key={blocks.length} className="border-l-2 border-indigo-300/50 pl-4 text-sm italic leading-6 text-zinc-300">
                    {renderInline(quote.join('\n'))}
                </blockquote>
            )
            continue
        }

        const paragraph: string[] = []
        while (
            index < lines.length &&
            lines[index].trim() &&
            !lines[index].trim().startsWith('```') &&
            !lines[index].match(/^(#{1,4})\s+(.+)$/) &&
            !isTableStart(lines, index) &&
            !/^\s*[-*]\s+/.test(lines[index]) &&
            !/^\s*\d+\.\s+/.test(lines[index]) &&
            !/^\s*>\s?/.test(lines[index])
        ) {
            paragraph.push(lines[index])
            index += 1
        }
        blocks.push(
            <p key={blocks.length} className="text-sm leading-6 text-zinc-100">
                {renderInline(paragraph.join('\n'))}
            </p>
        )
    }

    return <div className="space-y-4">{blocks}</div>
}

function isTableStart(lines: string[], index: number): boolean {
    return Boolean(
        lines[index]?.includes('|') &&
        lines[index + 1]?.match(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/)
    )
}

function splitTableRow(row: string): string[] {
    return row
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(cell => cell.trim())
}

function renderInline(text: string): ReactNode[] {
    const nodes: ReactNode[] = []
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|\n)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
        const token = match[0]
        const key = nodes.length

        if (token === '\n') {
            nodes.push(<br key={key} />)
        } else if (token.startsWith('`')) {
            nodes.push(
                <code key={key} className="rounded bg-black/40 px-1.5 py-0.5 text-[0.85em] text-cyan-100">
                    {token.slice(1, -1)}
                </code>
            )
        } else if (token.startsWith('**')) {
            nodes.push(<strong key={key} className="font-semibold text-white">{token.slice(2, -2)}</strong>)
        } else if (token.startsWith('*')) {
            nodes.push(<em key={key} className="italic text-zinc-100">{token.slice(1, -1)}</em>)
        } else {
            const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
            const href = link?.[2] ?? '#'
            const safeHref = /^(https?:|mailto:)/.test(href) ? href : '#'
            nodes.push(
                <a key={key} href={safeHref} target="_blank" rel="noreferrer" className="text-cyan-200 underline decoration-cyan-200/40 underline-offset-4">
                    {link?.[1] ?? token}
                </a>
            )
        }

        lastIndex = pattern.lastIndex
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
    return nodes
}

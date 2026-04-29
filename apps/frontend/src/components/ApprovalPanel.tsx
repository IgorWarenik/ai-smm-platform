'use client'
import { apiFetch } from '@/lib/api'
import { useState, type ReactNode } from 'react'
import { useLang } from '@/contexts/lang'

type Props = {
    projectId: string
    taskId: string
    agentOutputs?: Array<{ agentType: string; content: string }>
    onDecision: (result: any) => void
}

export default function ApprovalPanel({ projectId, taskId, agentOutputs, onDecision }: Props) {
    const { t } = useLang()
    const [comment, setComment] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const hasOutput = Boolean(agentOutputs?.length)

    const submit = async (decision: 'APPROVED' | 'REVISION_REQUESTED') => {
        if (!hasOutput) {
            setError(t('approval.errorLoading'))
            return
        }
        if (decision === 'REVISION_REQUESTED' && comment.trim().length < 50) {
            setError(t('approval.errorRevisionTooShort'))
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
            setError(err.message ?? t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-foreground">{t('approval.title')}</h3>

            {hasOutput ? (
                <div className="space-y-3">
                    {agentOutputs?.map((o, i) => (
                        <div key={i} className="rounded-lg border border-border bg-background p-4">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{o.agentType}</p>
                            <MarkdownContent content={o.content} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                    {t('approval.loading')}
                </div>
            )}

            <div>
                <label className="text-xs font-medium text-muted-foreground">
                    {t('approval.commentLabel')}
                </label>
                <textarea
                    value={comment}
                    onChange={e => { setComment(e.target.value); setError('') }}
                    rows={3}
                    className="mt-1.5 min-h-[110px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
                    placeholder={t('approval.commentPlaceholder')}
                />
                <p className="mt-1 text-xs text-muted-foreground">{comment.trim().length}/50</p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-wrap gap-3">
                <button onClick={() => submit('APPROVED')} disabled={loading || !hasOutput}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    {loading ? t('approval.sending') : t('approval.approve')}
                </button>
                <button onClick={() => submit('REVISION_REQUESTED')} disabled={loading || !hasOutput}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                    {t('approval.requestRevision')}
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
                <pre key={blocks.length} className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs leading-5 text-foreground">
                    <code>{code.join('\n')}</code>
                </pre>
            )
            continue
        }

        const heading = line.match(/^(#{1,4})\s+(.+)$/)
        if (heading) {
            const level = heading[1].length
            const className = level === 1
                ? 'text-xl font-bold text-foreground'
                : level === 2
                    ? 'text-lg font-bold text-foreground'
                    : 'text-base font-semibold text-foreground'
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
                <div key={blocks.length} className="overflow-x-auto rounded-md border border-border">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead className="bg-muted text-foreground">
                            <tr>
                                {header.map((cell, cellIndex) => (
                                    <th key={cellIndex} className="border-b border-border px-3 py-2 font-semibold">
                                        {renderInline(cell)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="align-top">
                                    {header.map((_, cellIndex) => (
                                        <td key={cellIndex} className="px-3 py-2 text-foreground">
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
                <ul key={blocks.length} className="list-disc space-y-1 pl-5 text-sm leading-6 text-foreground">
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
                <ol key={blocks.length} className="list-decimal space-y-1 pl-5 text-sm leading-6 text-foreground">
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
                <blockquote key={blocks.length} className="border-l-2 border-primary/30 pl-4 text-sm italic leading-6 text-muted-foreground">
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
            <p key={blocks.length} className="text-sm leading-6 text-foreground">
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
                <code key={key} className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] text-foreground">
                    {token.slice(1, -1)}
                </code>
            )
        } else if (token.startsWith('**')) {
            nodes.push(<strong key={key} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>)
        } else if (token.startsWith('*')) {
            nodes.push(<em key={key} className="italic text-foreground">{token.slice(1, -1)}</em>)
        } else {
            const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
            const href = link?.[2] ?? '#'
            const safeHref = /^(https?:|mailto:)/.test(href) ? href : '#'
            nodes.push(
                <a key={key} href={safeHref} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4 hover:opacity-80">
                    {link?.[1] ?? token}
                </a>
            )
        }

        lastIndex = pattern.lastIndex
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
    return nodes
}

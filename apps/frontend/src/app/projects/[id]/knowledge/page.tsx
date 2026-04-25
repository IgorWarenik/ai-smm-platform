'use client'
import { apiFetch } from '@/lib/api'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type KItem = { id: string; category: string; content: string; metadata?: Record<string, unknown> }

export default function KnowledgePage() {
    const { id: projectId } = useParams()
    const [items, setItems] = useState<KItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState<KItem[] | null>(null)

    const [category, setCategory] = useState('BRAND_GUIDE')
    const [content, setContent] = useState('')
    const [title, setTitle] = useState('')
    const [adding, setAdding] = useState(false)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

    const fetchItems = () => {
        apiFetch<{ data: KItem[] }>(`/api/projects/${projectId}/knowledge`)
            .then(({ data }) => setItems(data))
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchItems() }, [projectId])

    const handleSearch = async () => {
        if (!query) { setSearchResults(null); return }
        const { data } = await apiFetch<any>(`/api/projects/${projectId}/knowledge/search?q=${encodeURIComponent(query)}`)
        setSearchResults(data)
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setAdding(true)
        try {
            await apiFetch(`/api/projects/${projectId}/knowledge`, {
                method: 'POST',
                body: JSON.stringify({ category, content, metadata: { title } })
            })
            setContent('')
            setTitle('')
            fetchItems()
        } finally {
            setAdding(false)
        }
    }

    const handleDelete = async (itemId: string) => {
        if (!confirm('Delete this knowledge item?')) return
        try {
            await apiFetch(`/api/projects/${projectId}/knowledge/${itemId}`, { method: 'DELETE' })
            setItems(prev => prev.filter(i => i.id !== itemId))
        } catch (err: any) { setError(err.message ?? 'Delete failed') }
    }

    const handleEdit = async (itemId: string) => {
        if (!editContent.trim()) return
        try {
            const { data } = await apiFetch<{ data: KItem }>(`/api/projects/${projectId}/knowledge/${itemId}`, {
                method: 'PATCH',
                body: JSON.stringify({ content: editContent }),
            })
            setItems(prev => prev.map(i => i.id === itemId ? data : i))
            setEditingId(null)
        } catch (err: any) { setError(err.message ?? 'Edit failed') }
    }

    return (
        <div className="space-y-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="eyebrow">Semantic memory</p>
                    <h1 className="page-title mt-2">Knowledge</h1>
                </div>
                <p className="muted-text max-w-xl text-sm">
                    Store brand rules, cases, templates, and channel constraints for retrieval.
                </p>
            </div>

            <div className="glass-panel space-y-4 p-6">
                <h2 className="section-title">Search Knowledge Base</h2>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Semantic search..."
                        className="field flex-1"
                    />
                    <button onClick={handleSearch} className="btn-primary">Search</button>
                </div>
                {searchResults && (
                    <div className="mt-4 space-y-3">
                        <p className="eyebrow">Search Results</p>
                        {searchResults.map((r, i) => (
                            <div key={i} className="glass-panel-soft p-4 text-sm leading-6 text-zinc-100">
                                <span className="status-pill mr-2">{r.category}</span>
                                {r.content}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                    <h2 className="section-title">Add New Asset</h2>
                    <form onSubmit={handleAdd} className="glass-panel space-y-4 p-6">
                        <div>
                            <label className="field-label">Title (Optional)</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="field" />
                        </div>
                        <div>
                            <label className="field-label">Category</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="field">
                                {['FRAMEWORK', 'CASE', 'TEMPLATE', 'SEO', 'PLATFORM_SPEC', 'BRAND_GUIDE'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="field-label">Content</label>
                            <textarea value={content} onChange={e => setContent(e.target.value)} required rows={6} className="field min-h-[180px]" />
                        </div>
                        <button type="submit" disabled={adding} className="btn-primary w-full">
                            {adding ? 'Saving...' : 'Add to Knowledge Base'}
                        </button>
                    </form>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="section-title">All Assets</h2>
                        <span className="muted-text text-xs">{items.length} items</span>
                    </div>
                    {error && <p className="text-sm text-rose-200">{error}</p>}
                    {loading ? <p className="muted-text text-sm">Loading...</p> : (
                        <div className="space-y-3">
                            {items.map(item => (
                                <div key={item.id} className="glass-panel-soft p-4 text-sm">
                                    <span className="status-pill mb-3">{item.category}</span>
                                    {editingId === item.id ? (
                                        <div className="mt-2 space-y-3">
                                            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
                                                className="field min-h-[120px]" />
                                            <div className="flex flex-wrap gap-2">
                                                <button onClick={() => handleEdit(item.id)} className="btn-primary min-h-9 px-4 text-xs">Save</button>
                                                <button onClick={() => setEditingId(null)} className="btn-secondary min-h-9 px-4 text-xs">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="line-clamp-3 leading-6 text-zinc-200">{item.content}</p>
                                    )}
                                    <div className="mt-3 flex gap-3">
                                        <button onClick={() => { setEditingId(item.id); setEditContent(item.content) }}
                                            className="text-xs font-semibold text-indigo-200 hover:text-white">Edit</button>
                                        <button onClick={() => handleDelete(item.id)}
                                            className="text-xs font-semibold text-rose-200 hover:text-white">Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

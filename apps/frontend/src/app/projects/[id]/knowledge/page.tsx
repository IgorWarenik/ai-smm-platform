'use client'
import { apiFetch } from '@/lib/api'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type KItem = { id: string; category: string; content: string }

export default function KnowledgePage() {
    const { id: projectId } = useParams()
    const [items, setItems] = useState<KItem[]>([])
    const [loading, setLoading] = useState(true)

    // Search state
    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[] | null>(null)

    // Add state
    const [category, setCategory] = useState('BRAND_GUIDE')
    const [content, setContent] = useState('')
    const [title, setTitle] = useState('')
    const [adding, setAdding] = useState(false)

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

    return (
        <div className="space-y-10">
            <div className="bg-white p-6 border rounded-lg shadow-sm space-y-4">
                <h2 className="font-semibold">Search Knowledge Base</h2>
                <div className="flex gap-2">
                    <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Semantic search..." className="flex-1 border rounded px-3 py-2 text-sm" />
                    <button onClick={handleSearch} className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-black">Search</button>
                </div>
                {searchResults && (
                    <div className="space-y-2 mt-4">
                        <p className="text-xs font-bold text-gray-400">Search Results</p>
                        {searchResults.map((r, i) => (
                            <div key={i} className="text-sm p-3 bg-blue-50 border border-blue-100 rounded">
                                <span className="text-[10px] font-bold bg-blue-200 px-1 rounded mr-2">{r.category}</span>
                                {r.content}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h2 className="font-semibold">Add New Asset</h2>
                    <form onSubmit={handleAdd} className="space-y-4 bg-white p-6 border rounded-lg shadow-sm">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Title (Optional)</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Category</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                                {['FRAMEWORK', 'CASE', 'TEMPLATE', 'SEO', 'PLATFORM_SPEC', 'BRAND_GUIDE'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Content</label>
                            <textarea value={content} onChange={e => setContent(e.target.value)} required rows={6} className="w-full border rounded px-3 py-2 text-sm" />
                        </div>
                        <button type="submit" disabled={adding} className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700">
                            {adding ? 'Saving...' : 'Add to Knowledge Base'}
                        </button>
                    </form>
                </div>

                <div className="space-y-4">
                    <h2 className="font-semibold">All Assets</h2>
                    {loading ? <p className="text-sm text-gray-400">Loading...</p> : (
                        <div className="space-y-3">
                            {items.map(item => (
                                <div key={item.id} className="p-4 border rounded-lg bg-white text-sm">
                                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase mb-2 inline-block">{item.category}</span>
                                    <p className="text-gray-700 line-clamp-3">{item.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
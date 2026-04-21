import Link from 'next/link'

export default function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: { id: string }
}) {
    const { id } = params
    return (
        <div>
            <nav className="border-b bg-white px-6 py-3 flex items-center gap-6">
                <Link href={`/projects/${id}`}
                    className="text-sm font-medium hover:text-blue-600">Tasks</Link>
                <Link href={`/projects/${id}/profile`}
                    className="text-sm font-medium hover:text-blue-600">Profile</Link>
                <Link href={`/projects/${id}/knowledge`}
                    className="text-sm font-medium hover:text-blue-600">Knowledge</Link>
                <Link href="/dashboard"
                    className="ml-auto text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
            </nav>
            <main className="max-w-5xl mx-auto p-6">{children}</main>
        </div>
    )
}
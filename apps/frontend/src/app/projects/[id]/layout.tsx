'use client'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    const { id } = useParams() as { id: string }
    const pathname = usePathname()

    const navLinks = [
        { href: `/projects/${id}`, label: 'Tasks', exact: true },
        { href: `/projects/${id}/profile`, label: 'Profile' },
        { href: `/projects/${id}/knowledge`, label: 'Knowledge' },
        { href: `/projects/${id}/settings`, label: 'Settings' },
    ]

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b px-6 py-3 flex items-center gap-4">
                {navLinks.map(({ href, label, exact }) => {
                    const active = exact ? pathname === href : pathname.startsWith(href)
                    return (
                        <Link key={href} href={href}
                            className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                }`}>
                            {label}
                        </Link>
                    )
                })}
                <Link href="/dashboard"
                    className="ml-auto text-sm text-gray-400 hover:text-gray-600">
                    ← Dashboard
                </Link>
            </nav>
            <main className="max-w-5xl mx-auto p-6">
                {children}
            </main>
        </div>
    )
}
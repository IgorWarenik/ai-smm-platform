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
    ]

    return (
        <div className="space-page">
            <nav className="space-nav">
                {navLinks.map(({ href, label, exact }) => {
                    const active = exact ? pathname === href : pathname.startsWith(href)
                    return (
                        <Link key={href} href={href}
                            className={`nav-link ${active ? 'nav-link-active' : ''}`}>
                            {label}
                        </Link>
                    )
                })}
                <Link href="/dashboard"
                    className="nav-link ml-auto">
                    Dashboard
                </Link>
            </nav>
            <main className="space-container-wide">
                {children}
            </main>
        </div>
    )
}

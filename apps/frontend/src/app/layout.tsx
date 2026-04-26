import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth'
import { ProjectProvider } from '@/contexts/project'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'AI Marketing Platform',
  description: 'AI-powered marketing automation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ProjectProvider>
            {children}
          </ProjectProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

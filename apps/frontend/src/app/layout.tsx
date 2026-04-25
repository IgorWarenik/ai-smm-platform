import type { Metadata } from 'next'
import { Rajdhani } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth'

const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'AI Marketing Platform',
  description: 'AI-powered marketing automation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={rajdhani.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}

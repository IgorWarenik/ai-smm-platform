import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { AuthProvider } from '@/contexts/auth'
import { ProjectProvider } from '@/contexts/project'
import { LangProvider } from '@/contexts/lang'
import type { Lang } from '@/lib/i18n'

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700'] })

const DARK_BG  = 'hsl(240,10%,3.9%)'
const LIGHT_BG = 'hsl(0,0%,100%)'

export const metadata: Metadata = {
  title: 'AI SMM Platform',
  description: 'AI-powered SMM automation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const theme = cookieStore.get('theme')?.value
  const isDark = theme === 'dark'
  const cookieLang = cookieStore.get('lang')?.value
  const initialLang: Lang = cookieLang === 'en' ? 'en' : 'ru'

  return (
    // No inline style here — React hydration would overwrite it back to the server value,
    // causing a flash (light → dark) on the client. The inline script below handles
    // background color before first paint instead.
    <html lang={initialLang} className={isDark ? 'dark' : ''} suppressHydrationWarning>
      <head>
        {/* Runs synchronously in <head>, before CSS resolves and before first paint.
            Sets class + background color so the browser never shows the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches,dark=s==='dark'||(s===null&&d);document.documentElement.classList.toggle('dark',dark);document.documentElement.style.backgroundColor=dark?'${DARK_BG}':'${LIGHT_BG}';if(!document.cookie.includes('theme='))document.cookie='theme='+(dark?'dark':'light')+';path=/;max-age=31536000;SameSite=Lax';}catch(e){}})();` }} />
      </head>
      <body className={manrope.className}>
        <LangProvider initialLang={initialLang}>
          <AuthProvider>
            <ProjectProvider>
              {children}
            </ProjectProvider>
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  )
}

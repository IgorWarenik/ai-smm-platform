import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']
const APP_PATHS = ['/dashboard', '/new', '/tasks', '/calendar', '/library', '/project', '/settings']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
    ?? request.headers.get('authorization')?.replace('Bearer ', '')

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (!isPublic && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isPublic && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

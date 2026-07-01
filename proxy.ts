import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // No interceptar estas rutas de auth
  const authPaths = ['/logout', '/auth/confirm', '/auth/callback']
  if (authPaths.some(p => request.nextUrl.pathname.startsWith(p))) return supabaseResponse

  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role as string | undefined
  const path = request.nextUrl.pathname

  // Rutas protegidas por rol
  const isEmployeeRoute = path.startsWith('/dashboard')
  const isClientRoute = path.startsWith('/client')

  // Sin sesión → login
  if ((isEmployeeRoute || isClientRoute) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Cliente intentando acceder a rutas de empleado → su área
  if (isEmployeeRoute && role === 'client') {
    const url = request.nextUrl.clone()
    url.pathname = '/client'
    return NextResponse.redirect(url)
  }

  // Empleado intentando acceder a rutas de cliente → su área
  if (isClientRoute && role === 'employee') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Login con sesión activa → redirigir según rol
  if (path === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'client' ? '/client' : '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

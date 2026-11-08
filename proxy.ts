import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Entrada de leads (app/api/leads): la llama la web del centro, servidor a
  // servidor y sin sesión; se protege con firma HMAC. No hace falta getUser().
  if (request.nextUrl.pathname.startsWith('/api/leads')) return NextResponse.next()

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

  // No interceptar rutas de auth
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

  // Denegar por defecto: cada área solo para su rol.
  // Un usuario con sesión pero sin rol válido no entra en ninguna.
  const isStaff = role === 'employee' || role === 'admin'
  const isClient = role === 'client'
  const homeFor = isStaff ? '/dashboard' : isClient ? '/client' : null

  if ((isEmployeeRoute && !isStaff) || (isClientRoute && !isClient)) {
    const url = request.nextUrl.clone()
    url.pathname = homeFor ?? '/logout'
    return NextResponse.redirect(url)
  }

  // Login con sesión activa → redirigir según rol
  if (path === '/login' && user && homeFor) {
    const url = request.nextUrl.clone()
    url.pathname = homeFor
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

/**
 * middleware.ts — セッション更新 & ルート保護
 *
 * - 全リクエストで Supabase セッション Cookie をリフレッシュ
 *   (これがないと Route Handler の getUser() が古いトークンを見る)
 * - 未ログインで /chat にアクセスしたら /login へリダイレクト
 *   (API ルートはリダイレクトせず、各 route 内で 401 を返す)
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() を呼ぶことでトークンがリフレッシュされる
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // /chat は要ログイン (ページのみ。API は各 route で 401 を返す)
  const { pathname } = request.nextUrl
  if (!user && pathname.startsWith('/chat')) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // 静的アセットと画像最適化を除く全ルートに適用
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

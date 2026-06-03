/**
 * lib/supabase-server.ts — Supabase クライアント (サーバー: RLS適用)
 *
 * Server Component / Route Handler から、ログインユーザーの Cookie を引き継いだ
 * クライアントを生成する。anon キー + ユーザーJWT のため RLS が効く。
 * (管理操作・RLSバイパスが必要なときは lib/supabase.ts の getServiceClient を使う)
 *
 * ※ Next.js 14 系を想定 (cookies() は同期)。Next.js 15 系では cookies() が
 *   Promise を返すため、本ファイルの cookies() を await する必要がある。
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Server Component から呼ばれた場合は set が失敗するため握りつぶす
          // (セッション更新は middleware が担当)
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            /* noop */
          }
        },
      },
    }
  )
}

/** ログイン中のユーザーを取得 (未ログインなら null) */
export async function getUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

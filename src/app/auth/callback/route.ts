/**
 * app/auth/callback/route.ts
 *
 * マジックリンク / OTP のリダイレクト先。
 * URL の ?code= をセッションに交換し、元のページ (?next=) へ戻す。
 */

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/chat'

  if (code) {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 失敗時はログインへ戻す
  return NextResponse.redirect(`${origin}/login?error=auth`)
}

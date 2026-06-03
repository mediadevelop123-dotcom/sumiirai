/**
 * lib/supabase-browser.ts — Supabase クライアント (ブラウザ専用)
 *
 * クライアントコンポーネントから使用。anon キーのみを使い、
 * セッションは Cookie で管理される (@supabase/ssr)。
 */

'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

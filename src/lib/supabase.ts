/**
 * lib/supabase.ts — Supabase クライアント (サーバー専用)
 *
 * - getServiceClient(): Service Role キーで RLS をバイパスする管理クライアント。
 *   サーバー(Route Handler / スクリプト)からのみ使用すること。ブラウザに絶対に出さない。
 *
 * 既存の各 route.ts が個別に createClient していたが、本モジュールに集約する。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _service: SupabaseClient | null = null

/**
 * Service Role クライアント (シングルトン)。
 * RLS をバイパスするため、呼び出し側で user_id による絞り込みを必ず行うこと。
 */
export function getServiceClient(): SupabaseClient {
  if (_service) return _service

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL が設定されていません')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません')

  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _service
}

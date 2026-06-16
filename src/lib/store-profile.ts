/**
 * lib/store-profile.ts — 店舗プロフィール永続化レイヤー
 *
 * store_profiles テーブルへの読み書きを集約する。
 * Service Role クライアントを使うため、必ず userId で所有者を絞り込むこと
 * (RLS はバイパスされる)。
 *
 * 認証 (userId の取得) は呼び出し側の責務。本モジュールは userId を受け取る。
 */

import { getServiceClient } from '@/lib/supabase'

// ─── 型定義 ──────────────────────────────────────────────────

export interface StoreProfile {
  user_id:       string
  store_name:    string | null
  industry:      string | null
  prefecture:    string | null
  city:          string | null
  customer_base: string | null
  tone:          string | null
  notes:         string | null
  updated_at:    string
}

// ─── 読み取り ──────────────────────────────────────────────

/**
 * ユーザーの店舗プロフィールを取得する。
 * 未登録のユーザーは null を返す（エラーにしない）。
 */
export async function getStoreProfile(userId: string): Promise<StoreProfile | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('store_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`PROFILE_001: 店舗プロフィール取得失敗 — ${error.message}`)
  return (data as StoreProfile) ?? null
}

// ─── 書き込み ──────────────────────────────────────────────

/**
 * 店舗プロフィールを作成または更新する（upsert）。
 * 更新後のレコードを返す。
 */
export async function upsertStoreProfile(
  userId: string,
  fields: Partial<Omit<StoreProfile, 'user_id' | 'updated_at'>>
): Promise<StoreProfile> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('store_profiles')
    .upsert(
      { user_id: userId, ...fields },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) throw new Error(`PROFILE_002: 店舗プロフィール保存失敗 — ${error.message}`)
  return data as StoreProfile
}

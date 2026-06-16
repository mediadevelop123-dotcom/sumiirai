/**
 * lib/saved-subsidies-store.ts — 補助金ブックマーク永続化レイヤー
 *
 * saved_subsidies テーブルへの読み書きを集約する。
 * Service Role クライアントを使うため、必ず userId で所有者を絞り込むこと
 * (RLS はバイパスされる)。
 *
 * 認証 (userId の取得) は呼び出し側の責務。本モジュールは userId を受け取る。
 *
 * スコープ外（別フェーズ）:
 *   リマインドメール送信・cron は未実装。
 *   deadline / notified_at は将来のリマインド用に存在するが今回は参照しない。
 */

import { getServiceClient } from '@/lib/supabase'

// ─── 型定義 ──────────────────────────────────────────────────

/** snapshot に保存する補助金情報の shape */
export interface SubsidySnapshot {
  title:        string
  url:          string
  deadline?:    string | null
  max_amount?:  number | null
  subsidy_rate?: string | null
  prefecture?:  string | null
  catch_phrase?: string | null
  [key: string]: unknown
}

export interface SavedSubsidy {
  id:          string
  user_id:     string
  subsidy_id:  string | null
  snapshot:    SubsidySnapshot
  deadline:    string | null   // DATE → string
  notified_at: string | null   // 将来のリマインド用・今回は未使用
  created_at:  string
}

// ─── 読み取り ──────────────────────────────────────────────

/**
 * ユーザーのブックマーク済み補助金を created_at 降順で最大100件取得する。
 */
export async function listSavedSubsidies(userId: string): Promise<SavedSubsidy[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('saved_subsidies')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(`SAVEDSUB_001: ブックマーク一覧の取得失敗 — ${error.message}`)
  return (data as SavedSubsidy[]) ?? []
}

// ─── 書き込み ──────────────────────────────────────────────

/**
 * 補助金をブックマーク保存する。
 * UNIQUE(user_id, subsidy_id) に対して upsert するため、重複保存を防ぐ。
 * 保存したレコードを返す。
 */
export async function addSavedSubsidy(
  userId: string,
  fields: { subsidyId: string | null; snapshot: SubsidySnapshot; deadline?: string | null }
): Promise<SavedSubsidy> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('saved_subsidies')
    .upsert(
      {
        user_id:    userId,
        subsidy_id: fields.subsidyId ?? null,
        snapshot:   fields.snapshot,
        deadline:   fields.deadline ?? null,
      },
      { onConflict: 'user_id,subsidy_id' }
    )
    .select()
    .single()

  if (error) throw new Error(`SAVEDSUB_002: ブックマーク保存失敗 — ${error.message}`)
  return data as SavedSubsidy
}

// ─── 削除 ──────────────────────────────────────────────────

/**
 * 指定 id のブックマークを削除する。userId で所有者を必ず絞り込む。
 */
export async function deleteSavedSubsidy(id: string, userId: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('saved_subsidies')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(`SAVEDSUB_003: ブックマーク削除失敗 — ${error.message}`)
}

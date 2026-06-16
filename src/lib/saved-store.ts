/**
 * lib/saved-store.ts — 成果物保存（お気に入り）永続化レイヤー
 *
 * saved_outputs テーブルへの読み書きを集約する。
 * Service Role クライアントを使うため、必ず userId で所有者を絞り込むこと
 * (RLS はバイパスされる)。
 *
 * 認証 (userId の取得) は呼び出し側の責務。本モジュールは userId を受け取る。
 */

import { getServiceClient } from '@/lib/supabase'

// ─── 型定義 ──────────────────────────────────────────────────

export interface SavedOutput {
  id:         string
  user_id:    string
  title:      string | null
  content:    string
  category:   string | null
  created_at: string
}

// ─── 読み取り ──────────────────────────────────────────────

/**
 * ユーザーの保存済み成果物を created_at 降順で最大100件取得する。
 */
export async function listSavedOutputs(userId: string): Promise<SavedOutput[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('saved_outputs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(`SAVED_001: 保存済み成果物の取得失敗 — ${error.message}`)
  return (data as SavedOutput[]) ?? []
}

// ─── 書き込み ──────────────────────────────────────────────

/**
 * 成果物を新規保存する。保存したレコードを返す。
 */
export async function addSavedOutput(
  userId: string,
  fields: { title?: string | null; content: string; category?: string | null }
): Promise<SavedOutput> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('saved_outputs')
    .insert({
      user_id:  userId,
      title:    fields.title ?? null,
      content:  fields.content,
      category: fields.category ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`SAVED_002: 成果物の保存失敗 — ${error.message}`)
  return data as SavedOutput
}

// ─── 削除 ──────────────────────────────────────────────────

/**
 * 指定 id の成果物を削除する。userId で所有者を必ず絞り込む。
 */
export async function deleteSavedOutput(id: string, userId: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('saved_outputs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(`SAVED_003: 成果物の削除失敗 — ${error.message}`)
}

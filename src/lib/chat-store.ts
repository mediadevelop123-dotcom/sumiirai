/**
 * lib/chat-store.ts — チャット永続化レイヤー
 *
 * chat_sessions / chat_messages への読み書きを集約する。
 * Service Role クライアントを使うため、必ず userId で所有者を絞り込むこと
 * (RLS はバイパスされる)。
 *
 * 認証 (userId の取得) は呼び出し側の責務。本モジュールは userId を受け取る。
 */

import { getServiceClient } from '@/lib/supabase'
import type {
  ChatSession,
  ChatMessage,
  ChatRole,
  SubsidySource,
} from '@/lib/types'

// ─── セッション ───────────────────────────────────────────────

export async function createSession(params: {
  userId:      string
  title?:      string | null
  prefecture?: string | null
  industry?:   string | null
}): Promise<ChatSession> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id:    params.userId,
      title:      params.title ?? null,
      prefecture: params.prefecture ?? null,
      industry:   params.industry ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`CHAT_001: セッション作成失敗 — ${error.message}`)
  return data as ChatSession
}

export async function listSessions(
  userId: string,
  opts: { includeArchived?: boolean; limit?: number } = {}
): Promise<ChatSession[]> {
  const supabase = getServiceClient()
  let query = supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 50)

  if (!opts.includeArchived) query = query.eq('is_archived', false)

  const { data, error } = await query
  if (error) throw new Error(`CHAT_002: セッション一覧取得失敗 — ${error.message}`)
  return (data ?? []) as ChatSession[]
}

/** 所有者チェック付きでセッションを1件取得 (見つからなければ null) */
export async function getSession(
  sessionId: string,
  userId: string
): Promise<ChatSession | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`CHAT_003: セッション取得失敗 — ${error.message}`)
  return (data as ChatSession) ?? null
}

export async function renameSession(
  sessionId: string,
  userId: string,
  title: string
): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('chat_sessions')
    .update({ title })
    .eq('id', sessionId)
    .eq('user_id', userId)

  if (error) throw new Error(`CHAT_004: セッション名変更失敗 — ${error.message}`)
}

export async function archiveSession(
  sessionId: string,
  userId: string,
  archived = true
): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('chat_sessions')
    .update({ is_archived: archived })
    .eq('id', sessionId)
    .eq('user_id', userId)

  if (error) throw new Error(`CHAT_005: セッションアーカイブ失敗 — ${error.message}`)
}

export async function deleteSession(
  sessionId: string,
  userId: string
): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId)

  if (error) throw new Error(`CHAT_006: セッション削除失敗 — ${error.message}`)
}

// ─── メッセージ ───────────────────────────────────────────────

/** セッション内のメッセージを時系列 (古い順) で取得。所有者チェック付き */
export async function getMessages(
  sessionId: string,
  userId: string
): Promise<ChatMessage[]> {
  // 所有者チェック (他人のセッションIDを渡されても漏らさない)
  const session = await getSession(sessionId, userId)
  if (!session) return []

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`CHAT_007: メッセージ取得失敗 — ${error.message}`)
  return (data ?? []) as ChatMessage[]
}

export async function addMessage(params: {
  sessionId:    string
  role:         ChatRole
  content:      string
  llmModelId?:  string | null
  inputTokens?: number | null
  outputTokens?: number | null
  sources?:     SubsidySource[] | null
}): Promise<ChatMessage> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id:    params.sessionId,
      role:          params.role,
      content:       params.content,
      llm_model_id:  params.llmModelId ?? null,
      input_tokens:  params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      sources:       params.sources ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`CHAT_008: メッセージ保存失敗 — ${error.message}`)
  return data as ChatMessage
}

/**
 * タイトル未設定セッションに、最初のユーザー発話から自動タイトルを付与。
 * (先頭 30 文字を流用する簡易版。将来 LLM 要約に差し替え可)
 */
export async function ensureSessionTitle(
  sessionId: string,
  userId: string,
  firstUserText: string
): Promise<void> {
  const session = await getSession(sessionId, userId)
  if (!session || session.title) return

  const raw = firstUserText.trim()
  const title = raw.length === 0 ? '新しいチャット'
    : raw.length <= 30 ? raw
    : raw.slice(0, 28) + '…'
  await renameSession(sessionId, userId, title)
}

/**
 * lib/types.ts — DB 行型定義
 *
 * Supabase の各テーブルに対応する TypeScript 型。
 * マイグレーション (supabase/migrations/) と必ず整合させること。
 */

// ─── llm_models (004_chat.sql) ───────────────────────────────

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'amazon'
export type LLMModelType = 'chat' | 'embedding'

export interface LlmModel {
  id:                       string
  provider:                 LLMProvider
  family:                   string
  version:                  string | null
  display_name:             string
  model_type:               LLMModelType
  is_active:                boolean
  released_at:              string | null
  deprecated_at:            string | null
  shutdown_at:              string | null
  successor_id:             string | null
  input_price_per_1m_usd:   number | null
  output_price_per_1m_usd:  number | null
  context_window:           number | null
  max_output_tokens:        number | null
  capabilities:             Record<string, unknown>
  api_endpoint:             string | null
  api_model_id:             string
  created_at:               string
  updated_at:               string
}

// ─── chat_sessions (004_chat.sql) ────────────────────────────

export interface ChatSession {
  id:              string
  user_id:         string
  title:           string | null
  prefecture:      string | null
  industry:        string | null
  is_archived:     boolean
  last_message_at: string | null
  created_at:      string
  updated_at:      string
}

// ─── chat_messages (004_chat.sql) ────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system'

/** RAG で参照した補助金 (chat_messages.sources / SSE event:sources と整合) */
export interface SubsidySource {
  id:           string
  title:        string
  description?:  string | null
  catch_phrase?: string | null
  target?:      string | null
  industry?:    string | null
  prefecture?:  string | null
  max_amount?:  number | null
  subsidy_rate?: string | null
  deadline?:    string | null
  url:          string
  similarity:   number
}

export interface ChatMessage {
  id:            string
  session_id:    string
  role:          ChatRole
  content:       string
  llm_model_id:  string | null
  input_tokens:  number | null
  output_tokens: number | null
  sources:       SubsidySource[] | null
  created_at:    string
}

// ─── Insert 用 (DB がデフォルト値を埋めるカラムは省略可) ──────

export type ChatSessionInsert = Pick<ChatSession, 'user_id'> &
  Partial<Pick<ChatSession, 'title' | 'prefecture' | 'industry'>>

export type ChatMessageInsert = Pick<ChatMessage, 'session_id' | 'role' | 'content'> &
  Partial<Pick<ChatMessage, 'llm_model_id' | 'input_tokens' | 'output_tokens' | 'sources'>>

-- ============================================================
-- 004_chat.sql
-- チャット永続化基盤 (Phase 1 後半)
--   - llm_models    : LLMモデルマスタ (メッセージ単位でモデルを記録)
--   - chat_sessions : チャットセッション (1ユーザー = N セッション)
--   - chat_messages : メッセージ (セッション = N メッセージ)
-- ============================================================
-- 設計方針:
--   * 「1チャット=1LLM固定」ではなく、メッセージ単位で llm_model_id を記録
--     (ユーザーが会話途中でモデルを切り替える現代UXに対応)
--   * 新モデル追加 = INSERT 一発 / モデル廃止 = is_active=false + successor_id
--   * RLS: 本人 (auth.uid()) のみ自分のセッション/メッセージにアクセス可
--     (service_role はRLSをバイパスするためサーバー側APIは従来通り書き込み可)
--   * 保存期間: 1年 (created_at を基準に Phase 2.0 で日次削除cron)
-- ⚠ 前提: auth スキーマ (Supabase Auth) が有効であること
-- ============================================================

-- ============================================================
-- 1. llm_models — LLMモデルマスタ
-- ============================================================
CREATE TABLE IF NOT EXISTS llm_models (
  id                       TEXT        PRIMARY KEY,           -- 'openai-gpt-4o-mini' 等の内部ID
  provider                 TEXT        NOT NULL,              -- 'openai' | 'anthropic' | 'google'
  family                   TEXT        NOT NULL,              -- 'gpt-4o-mini' | 'claude-haiku' 等
  version                  TEXT,
  display_name             TEXT        NOT NULL,
  model_type               TEXT        NOT NULL DEFAULT 'chat'  -- 'chat' | 'embedding'
                             CHECK (model_type IN ('chat', 'embedding')),
  is_active                BOOLEAN     NOT NULL DEFAULT TRUE,
  released_at              TIMESTAMPTZ,
  deprecated_at            TIMESTAMPTZ,                       -- 廃止予告日
  shutdown_at              TIMESTAMPTZ,                       -- 完全停止日
  successor_id             TEXT        REFERENCES llm_models(id),  -- 後継モデル
  input_price_per_1m_usd   NUMERIC(10,4),
  output_price_per_1m_usd  NUMERIC(10,4),
  context_window           INTEGER,
  max_output_tokens        INTEGER,
  capabilities             JSONB       NOT NULL DEFAULT '{}', -- {"vision": true, ...}
  api_endpoint             TEXT,                              -- カスタムendpoint (Bedrock/Azure等)
  api_model_id             TEXT        NOT NULL,              -- 実API呼び出し時のモデル名
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- llm_models は全ユーザー読み取り可 (UIのモデル選択等)。書き込みは service_role のみ
ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "llm_models_read_all" ON llm_models;
CREATE POLICY "llm_models_read_all" ON llm_models FOR SELECT USING (true);

-- updated_at 自動更新 (set_updated_at() は 001_subsidies.sql で定義済み)
DROP TRIGGER IF EXISTS llm_models_updated_at ON llm_models;
CREATE TRIGGER llm_models_updated_at BEFORE UPDATE ON llm_models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. chat_sessions — チャットセッション
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT,                                      -- 自動生成 (最初の質問の要約等)
  prefecture      TEXT,                                      -- セッションの都道府県フィルタ
  industry        TEXT,                                      -- 業種 (将来の業種別プロンプト用)
  is_archived     BOOLEAN     NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_idx
  ON chat_sessions (user_id, last_message_at DESC NULLS LAST);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_sessions_select_own" ON chat_sessions;
CREATE POLICY "chat_sessions_select_own" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_sessions_insert_own" ON chat_sessions;
CREATE POLICY "chat_sessions_insert_own" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_sessions_update_own" ON chat_sessions;
CREATE POLICY "chat_sessions_update_own" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_sessions_delete_own" ON chat_sessions;
CREATE POLICY "chat_sessions_delete_own" ON chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. chat_messages — メッセージ
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content       TEXT        NOT NULL,
  llm_model_id  TEXT        REFERENCES llm_models(id),       -- assistant メッセージのみ設定
  input_tokens  INTEGER,                                     -- プロンプト側トークン (コスト計算用)
  output_tokens INTEGER,                                     -- 生成側トークン
  sources       JSONB,                                       -- RAGで参照した補助金リスト (assistant)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- セッション内のメッセージを時系列取得するための複合インデックス
CREATE INDEX IF NOT EXISTS chat_messages_session_idx
  ON chat_messages (session_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 自分が所有するセッションのメッセージのみアクセス可
DROP POLICY IF EXISTS "chat_messages_select_own" ON chat_messages;
CREATE POLICY "chat_messages_select_own" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert_own" ON chat_messages;
CREATE POLICY "chat_messages_insert_own" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_delete_own" ON chat_messages;
CREATE POLICY "chat_messages_delete_own" ON chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. メッセージ挿入時に chat_sessions.last_message_at を更新
-- ============================================================
CREATE OR REPLACE FUNCTION touch_session_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE chat_sessions
    SET last_message_at = NEW.created_at,
        updated_at      = NOW()
    WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_touch_session ON chat_messages;
CREATE TRIGGER chat_messages_touch_session AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION touch_session_last_message();

-- ============================================================
-- 5. llm_models 初期データ (Phase 1)
--    料金は 2026 年時点の概算 (USD / 1M tokens)。実値は定期的に見直すこと
-- ============================================================
INSERT INTO llm_models (
  id, provider, family, version, display_name, model_type,
  input_price_per_1m_usd, output_price_per_1m_usd,
  context_window, max_output_tokens, capabilities, api_endpoint, api_model_id
) VALUES
  -- ── チャットモデル ──
  ('openai-gpt-4o-mini', 'openai', 'gpt-4o-mini', '2024-07-18',
   'GPT-4o mini', 'chat',
   0.15, 0.60, 128000, 16384,
   '{"vision": true, "function_calling": true}'::jsonb,
   NULL, 'gpt-4o-mini'),

  ('bedrock-claude-3-haiku', 'anthropic', 'claude-haiku', '3-20240307',
   'Claude 3 Haiku (Bedrock)', 'chat',
   0.25, 1.25, 200000, 4096,
   '{"vision": true, "function_calling": true}'::jsonb,
   'bedrock', 'anthropic.claude-3-haiku-20240307-v1:0'),

  ('bedrock-claude-haiku-4-5', 'anthropic', 'claude-haiku', '4.5',
   'Claude Haiku 4.5 (Bedrock)', 'chat',
   0.80, 4.00, 200000, 64000,
   '{"vision": false}'::jsonb,
   'bedrock', 'us.anthropic.claude-haiku-4-5-20251001-v1:0'),

  -- ── 埋め込みモデル ──
  ('openai-text-embedding-3-small', 'openai', 'text-embedding-3-small', NULL,
   'text-embedding-3-small', 'embedding',
   0.02, NULL, 8191, NULL,
   '{"dimensions": 1536}'::jsonb,
   NULL, 'text-embedding-3-small'),

  ('bedrock-titan-embed-v2', 'amazon', 'titan-embed-text-v2', NULL,
   'Titan Embeddings V2 (Bedrock)', 'embedding',
   0.02, NULL, 8192, NULL,
   '{"dimensions": 1024}'::jsonb,
   'bedrock', 'amazon.titan-embed-text-v2:0')
ON CONFLICT (id) DO NOTHING;

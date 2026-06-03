-- ============================================================
-- 補助金テーブル & 埋め込みテーブル (Phase 1 初期スキーマ)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 補助金マスタ
CREATE TABLE IF NOT EXISTS subsidies (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id    TEXT        UNIQUE NOT NULL,        -- jGrants 補助金ID
  title          TEXT        NOT NULL,
  description    TEXT,                               -- jGrants: detail
  catch_phrase   TEXT,                               -- jGrants: subsidy_catch_phrase
  target         TEXT,                               -- jGrants: use_purpose (対象・用途)
  industry       TEXT,                               -- 収集時の業種ラベル
  prefecture     TEXT,                               -- jGrants: target_area_search
  max_amount     BIGINT,                             -- jGrants: subsidy_max_limit (円)
  subsidy_rate   TEXT,                               -- 補助率
  deadline       TIMESTAMPTZ,                        -- jGrants: acceptance_end_datetime
  accepted_at    TIMESTAMPTZ,                        -- jGrants: acceptance_start_datetime
  url            TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 全ユーザーが読み取り可能(補助金検索用)
ALTER TABLE subsidies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subsidies_read_all" ON subsidies FOR SELECT USING (true);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER subsidies_updated_at BEFORE UPDATE ON subsidies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ベクトル埋め込み
CREATE TABLE IF NOT EXISTS subsidy_embeddings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subsidy_id    UUID        UNIQUE NOT NULL REFERENCES subsidies(id) ON DELETE CASCADE,
  embedding     vector(1536),                        -- text-embedding-3-small
  embedded_text TEXT,                                -- デバッグ用(何をベクトル化したか)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ivfflat インデックス(件数が増えたら lists の値を調整)
CREATE INDEX ON subsidy_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE subsidy_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subsidy_embeddings_read_all" ON subsidy_embeddings FOR SELECT USING (true);

-- ============================================================
-- pgvector 検索関数
-- ============================================================
CREATE OR REPLACE FUNCTION search_subsidies(
  query_embedding vector(1536),
  filter_prefecture TEXT DEFAULT NULL,
  match_count       INT  DEFAULT 10
)
RETURNS TABLE (
  id           UUID,
  title        TEXT,
  description  TEXT,
  catch_phrase TEXT,
  target       TEXT,
  industry     TEXT,
  prefecture   TEXT,
  max_amount   BIGINT,
  subsidy_rate TEXT,
  deadline     TIMESTAMPTZ,
  url          TEXT,
  similarity   FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id, s.title, s.description, s.catch_phrase, s.target,
    s.industry, s.prefecture, s.max_amount, s.subsidy_rate, s.deadline, s.url,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM subsidy_embeddings se
  JOIN subsidies s ON s.id = se.subsidy_id
  WHERE s.is_active = true
    AND (filter_prefecture IS NULL
         OR s.prefecture ILIKE '%' || filter_prefecture || '%')
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
$$;

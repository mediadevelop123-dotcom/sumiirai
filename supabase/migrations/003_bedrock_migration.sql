-- ============================================================
-- 003_bedrock_migration.sql
-- Amazon Bedrock 移行: vector(1536) → vector(1024)
-- Titan Embeddings V2 の次元数に合わせる
-- ============================================================
-- ⚠ 前提: 001_subsidies.sql と 002_subsidies_izumi.sql が適用済みであること
--
-- ⚠ 実行後に必ず埋め込みを再生成すること:
--   npx tsx scripts/sync-subsidies.ts
--   npx tsx scripts/import-izumi-csv.ts <path-to-csv>
-- ============================================================

-- 既存の検索関数を削除 (シグネチャが変わるため)
DROP FUNCTION IF EXISTS search_subsidies(vector, TEXT, INT);

-- ivfflat インデックスを動的に特定して削除
-- (次元変更前にインデックスを落とす必要がある)
DO $$
DECLARE
  idx_name TEXT;
BEGIN
  SELECT indexname INTO idx_name
  FROM pg_indexes
  WHERE tablename = 'subsidy_embeddings'
    AND indexdef ILIKE '%ivfflat%';
  IF idx_name IS NOT NULL THEN
    EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(idx_name);
    RAISE NOTICE 'Dropped index: %', idx_name;
  END IF;
END $$;

-- 既存の埋め込みデータを削除
-- (次元が変わるため再生成が必要。subsidies テーブルのデータは保持)
TRUNCATE TABLE subsidy_embeddings;

-- ベクトル列の次元を 1536 → 1024 に変更
ALTER TABLE subsidy_embeddings
  ALTER COLUMN embedding TYPE vector(1024);

-- 新しい ivfflat インデックス (1024次元)
CREATE INDEX subsidy_embeddings_embedding_idx
  ON subsidy_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- 新しい検索関数
--   - 1024次元対応
--   - difficulty, source カラムを返す (002 で追加済み)
-- ============================================================
CREATE OR REPLACE FUNCTION search_subsidies(
  query_embedding   vector(1024),
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
  difficulty   TEXT,
  deadline     TIMESTAMPTZ,
  url          TEXT,
  source       TEXT,
  similarity   FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id,
    s.title,
    s.description,
    s.catch_phrase,
    s.target,
    s.industry,
    s.prefecture,
    s.max_amount,
    s.subsidy_rate,
    s.difficulty,
    s.deadline,
    s.url,
    s.source,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM subsidy_embeddings se
  JOIN subsidies s ON s.id = se.subsidy_id
  WHERE s.is_active = true
    AND (filter_prefecture IS NULL
         OR s.prefecture ILIKE '%' || filter_prefecture || '%')
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
$$;

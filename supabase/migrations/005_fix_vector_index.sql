-- ============================================================
-- 005_fix_vector_index.sql
-- ベクトルインデックスの修正
--
-- 問題: lists=100 だが現在の行数は ~400件 → lists あたり 4行しかなく
--       IVFFlat の近似検索精度が著しく低下する
-- 解決: HNSW に切り替え (小〜中規模では IVFFlat より安定して高精度)
--       ※ HNSW は行数に関わらず lists チューニング不要
-- ============================================================

-- 既存の IVFFlat インデックスを削除
DROP INDEX IF EXISTS subsidy_embeddings_embedding_idx;

-- HNSW インデックスを作成（m=16, ef_construction=64 はデフォルト推奨値）
CREATE INDEX subsidy_embeddings_embedding_hnsw_idx
  ON subsidy_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 検索精度向上のため ef_search を大きめに設定（接続ごと、または GUC で設定）
-- ALTER SYSTEM SET hnsw.ef_search = 100;  -- オプション: デフォルト40

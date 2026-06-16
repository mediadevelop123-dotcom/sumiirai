-- ============================================================
-- 009_saved_outputs.sql
-- 成果物保存（お気に入り）機能 (Phase 2 顧客定着機能)
--
--   - saved_outputs : ユーザーが保存したAI生成成果物
--
-- 目的:
--   チャットのAI応答を「保存」して後から再利用できる資産として蓄積。
--   タイトル（先頭30字自動生成）・カテゴリ（subsidy/business）・
--   生テキスト（Markdown）を保存する。
--
-- RLS:
--   auth.uid() = user_id で SELECT/INSERT/DELETE のみ許可。
--   service_role は RLS をバイパスするため、サーバー側 API は
--   userId で絞り込みを行う（chat_sessions と同パターン）。
-- ============================================================

-- ============================================================
-- 1. saved_outputs — 保存済み成果物
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_outputs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,                                     -- 先頭30字程度の自動生成タイトル
  content     TEXT        NOT NULL,                     -- AI生成テキスト（Markdown生テキスト）
  category    TEXT,                                     -- 'subsidy' | 'business'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_outputs_user_idx
  ON saved_outputs (user_id, created_at DESC);

-- ============================================================
-- 2. RLS — 本人のみ読み書き可
-- ============================================================
ALTER TABLE saved_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_outputs_select_own" ON saved_outputs;
CREATE POLICY "saved_outputs_select_own" ON saved_outputs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_outputs_insert_own" ON saved_outputs;
CREATE POLICY "saved_outputs_insert_own" ON saved_outputs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_outputs_delete_own" ON saved_outputs;
CREATE POLICY "saved_outputs_delete_own" ON saved_outputs
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 010_saved_subsidies.sql
-- 補助金ブックマーク（保存）機能 (Phase 2 顧客定着機能)
--
--   - saved_subsidies : ユーザーがブックマークした補助金
--
-- 目的:
--   AIが提示した補助金を「保存」して後から一覧確認できる資産として蓄積。
--   元の補助金データが更新・削除されても参照できるよう snapshot に
--   title/url/deadline/max_amount/subsidy_rate/prefecture/catch_phrase を保存する。
--
-- スコープ外（別フェーズ）:
--   - リマインドメール送信 — メールプロバイダ選定・環境変数追加が必要。未実装。
--   - cron による定期送信 — GitHub Actions or Vercel Cron。未実装。
--   - deadline / notified_at カラムは将来のリマインド用に定義のみ。今回は表示のみ使用。
--
-- RLS:
--   auth.uid() = user_id で SELECT/INSERT/DELETE のみ許可。
--   service_role は RLS をバイパスするため、サーバー側 API は
--   userId で絞り込みを行う（009_saved_outputs と同パターン）。
-- ============================================================

-- ============================================================
-- 1. saved_subsidies — ブックマーク済み補助金
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_subsidies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subsidy_id  TEXT,                                     -- subsidies.id（動的）or static id
  snapshot    JSONB       NOT NULL,                     -- title/url/deadline/max_amount/subsidy_rate/prefecture/catch_phrase 等を保存（元データが消えても残す）
  deadline    DATE,                                     -- 通知判定用に抜き出し（将来のリマインド用・今回は表示のみ）
  notified_at TIMESTAMPTZ,                              -- 将来のリマインド用（重複送信防止）。今回は未使用。
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, subsidy_id)
);

CREATE INDEX IF NOT EXISTS saved_subsidies_user_idx
  ON saved_subsidies (user_id, created_at DESC);

-- ============================================================
-- 2. RLS — 本人のみ読み書き可
-- ============================================================
ALTER TABLE saved_subsidies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_subsidies_select_own" ON saved_subsidies;
CREATE POLICY "saved_subsidies_select_own" ON saved_subsidies
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_subsidies_insert_own" ON saved_subsidies;
CREATE POLICY "saved_subsidies_insert_own" ON saved_subsidies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_subsidies_delete_own" ON saved_subsidies;
CREATE POLICY "saved_subsidies_delete_own" ON saved_subsidies
  FOR DELETE USING (auth.uid() = user_id);

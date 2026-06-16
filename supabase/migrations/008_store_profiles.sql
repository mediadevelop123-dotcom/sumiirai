-- ============================================================
-- 008_store_profiles.sql
-- 店舗プロフィール一元登録 (Phase 2 顧客定着機能)
--
--   - store_profiles : ユーザーごとの店舗情報（1ユーザー = 1レコード）
--
-- 目的:
--   店名・業種・地域・客層・トーン・特徴を1回登録し、
--   全プロンプト（business/subsidy 両モード）に自動注入する。
--
-- RLS:
--   auth.uid() = user_id で SELECT/INSERT/UPDATE のみ許可。
--   service_role は RLS をバイパスするため、サーバー側 API は
--   userId で絞り込みを行う（chat_sessions と同パターン）。
-- ============================================================

-- ============================================================
-- 1. store_profiles — 店舗プロフィール
-- ============================================================
CREATE TABLE IF NOT EXISTS store_profiles (
  user_id       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name    TEXT,                                     -- 店名
  industry      TEXT,                                     -- 業種（INDUSTRY_LIST と揃える想定）
  prefecture    TEXT,                                     -- 都道府県
  city          TEXT,                                     -- 市区町村
  customer_base TEXT,                                     -- 客層メモ（例: 30〜50代の女性が中心）
  tone          TEXT,                                     -- 希望トーン（例: 丁寧・カジュアル）
  notes         TEXT,                                     -- 強み・特徴の自由メモ
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 自動更新 (set_updated_at() は 001_subsidies.sql で定義済み)
DROP TRIGGER IF EXISTS store_profiles_updated_at ON store_profiles;
CREATE TRIGGER store_profiles_updated_at BEFORE UPDATE ON store_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. RLS — 本人のみ読み書き可
-- ============================================================
ALTER TABLE store_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_profiles_select_own" ON store_profiles;
CREATE POLICY "store_profiles_select_own" ON store_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "store_profiles_insert_own" ON store_profiles;
CREATE POLICY "store_profiles_insert_own" ON store_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "store_profiles_update_own" ON store_profiles;
CREATE POLICY "store_profiles_update_own" ON store_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

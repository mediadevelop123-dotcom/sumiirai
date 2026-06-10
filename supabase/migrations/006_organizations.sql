-- ============================================================
-- 006_organizations.sql
-- マルチテナント基盤 (Phase 2)
--
--   - organizations  : 会社マスター
--   - user_profiles  : ユーザー ↔ 会社 の紐付け + ロール管理
--   - chat_sessions に org_id カラムを追加（使用量集計・将来課金用）
--
-- ロール定義:
--   super_admin : 全会社を管理（org_id = NULL）
--   org_admin   : 自社ユーザーを管理
--   member      : チャットのみ
--
-- 初期スーパー管理者:
--   sumi@media-partners.co.jp
--   t.teranishi@media-partners.co.jp
-- ============================================================

-- ============================================================
-- 1. organizations — 会社マスター
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  plan       TEXT        NOT NULL DEFAULT 'trial'
               CHECK (plan IN ('trial', 'basic', 'pro')),
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. user_profiles — ユーザーとロール管理
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  role       TEXT        NOT NULL DEFAULT 'member'
               CHECK (role IN ('super_admin', 'org_admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_profiles_org_idx ON user_profiles (org_id);

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. RLS用ヘルパー関数（SECURITY DEFINER で自己参照ループを回避）
--    service_role はRLSをバイパスするためサーバー側APIには影響しない
-- ============================================================
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_auth_user_org()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 4. organizations の RLS
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select_own" ON organizations;
CREATE POLICY "organizations_select_own" ON organizations
  FOR SELECT USING (
    get_auth_user_role() = 'super_admin'
    OR (
      get_auth_user_role() IN ('org_admin', 'member')
      AND id = get_auth_user_org()
    )
  );

-- ============================================================
-- 5. user_profiles の RLS
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
CREATE POLICY "user_profiles_select_own" ON user_profiles
  FOR SELECT USING (
    auth.uid() = user_id
    OR get_auth_user_role() = 'super_admin'
    OR (
      get_auth_user_role() = 'org_admin'
      AND org_id = get_auth_user_org()
    )
  );

-- ============================================================
-- 6. chat_sessions に org_id を追加（使用量集計・課金用）
-- ============================================================
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS chat_sessions_org_idx
  ON chat_sessions (org_id, created_at DESC);

-- ============================================================
-- 7. 初期スーパー管理者を登録
-- ============================================================
DO $$
DECLARE
  v_user_id UUID;
  v_emails  TEXT[] := ARRAY[
    'sumi@media-partners.co.jp',
    't.teranishi@media-partners.co.jp'
  ];
  v_email   TEXT;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id INTO v_user_id
      FROM auth.users
      WHERE email = v_email
      LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO user_profiles (user_id, org_id, role)
        VALUES (v_user_id, NULL, 'super_admin')
      ON CONFLICT (user_id)
        DO UPDATE SET role = 'super_admin', org_id = NULL, updated_at = NOW();

      RAISE NOTICE 'super_admin 設定完了: %', v_email;
    ELSE
      RAISE NOTICE 'ユーザーが見つかりません（スキップ）: %', v_email;
    END IF;
  END LOOP;
END $$;

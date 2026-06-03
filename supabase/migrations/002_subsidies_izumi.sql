-- ============================================================
-- 002_subsidies_izumi.sql
-- j-izumi.com CSV 取り込み対応カラム追加
-- ============================================================

-- データソースの識別 (jgrants / j-izumi)
ALTER TABLE subsidies
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'jgrants';

-- 申請難易度 (j-izumi 独自項目)
ALTER TABLE subsidies
  ADD COLUMN IF NOT EXISTS difficulty TEXT;

-- 既存レコードはすべて jgrants ソース
UPDATE subsidies SET source = 'jgrants' WHERE source IS NULL;

-- source を検索条件に使うためのインデックス
CREATE INDEX IF NOT EXISTS subsidies_source_idx ON subsidies(source);

/**
 * scripts/verify-schema.ts — マイグレーション結果の検証
 *   npx tsx --env-file=.env.local scripts/verify-schema.ts
 */

import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1) }

async function main() {
  const url = new URL(DATABASE_URL!.trim())
  const client = new Client({
    host:     url.hostname.trim(),
    port:     Number(url.port) || 5432,
    user:     decodeURIComponent(url.username).trim(),
    password: decodeURIComponent(url.password).trim(),
    database: (url.pathname.replace('/', '') || 'postgres').trim(),
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  // テーブル一覧
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `)
  console.log('📋 public スキーマのテーブル:')
  tables.rows.forEach(r => console.log(`  - ${r.table_name}`))

  // llm_models シード
  const models = await client.query(`
    SELECT id, provider, model_type, display_name FROM llm_models ORDER BY id
  `)
  console.log(`\n🤖 llm_models (${models.rowCount} 件):`)
  models.rows.forEach(r =>
    console.log(`  - ${r.id} [${r.model_type}] ${r.display_name}`))

  // subsidy_embeddings の次元確認
  const dim = await client.query(`
    SELECT a.atttypmod AS dimension
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'subsidy_embeddings' AND a.attname = 'embedding'
  `)
  console.log(`\n📐 subsidy_embeddings.embedding 次元: ${dim.rows[0]?.dimension ?? '不明'}`)

  // subsidies 件数 (active/inactive 内訳)
  const countAll   = await client.query(`SELECT COUNT(*) FROM subsidies`)
  const countActive = await client.query(`SELECT COUNT(*) FROM subsidies WHERE is_active = true`)
  console.log(`📊 subsidies 合計: ${countAll.rows[0].count} (active: ${countActive.rows[0].count})`)
  const embCount = await client.query(`SELECT COUNT(*) FROM subsidy_embeddings`)
  console.log(`📊 subsidy_embeddings 件数: ${embCount.rows[0].count}`)

  // active なサンプル表示
  const sample = await client.query(
    `SELECT external_id, title, is_active FROM subsidies ORDER BY created_at DESC LIMIT 5`
  )
  console.log('\n📝 最新5件サンプル:')
  sample.rows.forEach(r =>
    console.log(`  [${r.is_active ? 'active' : 'INACTIVE'}] ${r.title?.slice(0,40)} (${r.external_id?.slice(0,20)}...)`)
  )

  await client.end()
  console.log('\n✅ 検証完了')
}

main()

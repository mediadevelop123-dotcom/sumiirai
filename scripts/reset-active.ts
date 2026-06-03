/**
 * scripts/reset-active.ts — 全補助金を一時的に active に戻す（デバッグ用）
 * npx tsx --env-file=.env.local scripts/reset-active.ts
 */
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL 未設定'); process.exit(1) }

async function main() {
  const url = new URL(DATABASE_URL!.trim())
  const client = new Client({
    host: url.hostname.trim(), port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username).trim(),
    password: decodeURIComponent(url.password).trim(),
    database: (url.pathname.replace('/', '') || 'postgres').trim(),
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  const result = await client.query(`UPDATE subsidies SET is_active = true`)
  console.log(`✅ ${result.rowCount} 件を active に更新しました`)
  await client.end()
}

main()

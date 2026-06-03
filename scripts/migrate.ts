/**
 * scripts/migrate.ts — Supabase マイグレーション実行スクリプト
 *
 * 実行方法:
 *   DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres \
 *   npx tsx scripts/migrate.ts
 *
 * または .env.local に DATABASE_URL を追加してから:
 *   npx tsx --env-file=.env.local scripts/migrate.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL が設定されていません')
  process.exit(1)
}

const MIGRATIONS = [
  '001_subsidies.sql',
  '002_subsidies_izumi.sql',
  '003_bedrock_migration.sql',
  '004_chat.sql',
]

// Supabase プーラーの主要リージョン (見つかるまで順に試す)
const REGIONS = [
  'ap-northeast-1', // 東京
  'ap-northeast-2', // ソウル
  'ap-southeast-1', // シンガポール
  'us-east-1',      // バージニア
  'us-west-1',      // N.カリフォルニア
  'eu-central-1',   // フランクフルト
  'eu-west-1',      // アイルランド
  'ap-southeast-2', // シドニー
  'us-east-2',      // オハイオ
  'ap-south-1',     // ムンバイ
]

async function connectAutoRegion(
  user: string, password: string, database: string, port: number,
): Promise<Client> {
  for (const cluster of ['aws-0', 'aws-1']) {
    for (const region of REGIONS) {
      const host = `${cluster}-${region}.pooler.supabase.com`
      const client = new Client({
        host, port, user, password, database,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      })
      try {
        process.stdout.write(`  ↳ ${host} を試行... `)
        await client.connect()
        console.log('✅ 接続成功!')
        return client
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('not found') || msg.includes('Tenant or user not found')) {
          console.log('該当なし')
        } else if (msg.includes('password') || msg.includes('authentication')) {
          console.log('⚠ パスワード認証失敗 (ホストは正解!)')
          await client.end().catch(() => {})
          throw new Error(`ホスト ${host} は正しいですが、DBパスワードが違います`)
        } else {
          console.log(`別エラー: ${msg.split('\n')[0]}`)
        }
        await client.end().catch(() => {})
      }
    }
  }
  throw new Error('全リージョンで tenant が見つかりませんでした。Connectボタンで正確なホスト名を確認してください')
}

async function main() {
  const url = new URL(DATABASE_URL!.trim())
  const user = decodeURIComponent(url.username).trim()
  const database = (url.pathname.replace('/', '') || 'postgres').trim()
  const password = decodeURIComponent(url.password).trim()
  const port = Number(url.port) || 5432
  console.log(`🔍 user=[${user}] db=[${database}] port=${port}`)
  console.log(`🌏 リージョンを自動検出します...\n`)

  const client = await connectAutoRegion(user, password, database, port)
  console.log('✅ Supabase DB に接続しました\n')

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join('supabase/migrations', file), 'utf-8')
    console.log(`▶ ${file} を実行中...`)
    try {
      await client.query(sql)
      console.log(`  ✅ 完了\n`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // すでに存在するオブジェクト等は警告扱いで続行
      if (msg.includes('already exists') || msg.includes('does not exist')) {
        console.warn(`  ⚠ スキップ (${msg.split('\n')[0]})\n`)
      } else {
        console.error(`  ❌ エラー: ${msg}\n`)
        await client.end()
        process.exit(1)
      }
    }
  }

  await client.end()
  console.log('🎉 全マイグレーション完了!')
}

main()

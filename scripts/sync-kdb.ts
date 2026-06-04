/**
 * scripts/sync-kdb.ts
 *
 * 自社補助金DB (KDB / さくらインターネット MySQL) → Supabase 同期スクリプト
 * SSHトンネルを自動で開いて接続します。
 *
 * 実行: npx tsx scripts/sync-kdb.ts
 *
 * 必要な環境変数:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   KDB_SSH_HOST       例: test-mp.sakura.ne.jp
 *   KDB_SSH_USER       例: test-mp
 *   KDB_SSH_KEY        例: C:/Users/perch/.ssh/id_ed25519
 *   KDB_DB_HOST        MySQL ホスト (さくら内部): mysql80.mediapartners.sakura.ne.jp
 *   KDB_DATABASE       データベース名
 *   KDB_USER           MySQLユーザー名
 *   KDB_PASSWORD       MySQLパスワード
 *   KDB_TABLE          テーブル名 (デフォルト: subsidy_applications)
 *   KDB_LOCAL_PORT     トンネル用ローカルポート (デフォルト: 13306)
 *   LLM_PROVIDER=bedrock + AWS_* (embedding生成用)
 */

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '../src/lib/llm'
import { spawn } from 'child_process'

// ─── 型定義 ──────────────────────────────────────────────────

interface KdbRecord {
  id: number
  name: string
  type: string | null
  area1: string | null
  area2: string | null
  area3: string | null
  applicants: string | null
  Subsidy_target: string | null
  project_description: string | null
  subsidy_limit: number | null
  amount_remarks: string | null
  apply_start_date: string | null
  apply_end_date: string | null
  official_url: string | null
  search_keywords: string | null
  review_status: string | null
}

// ─── Supabase ────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── SSHトンネル起動 ─────────────────────────────────────────

function openTunnel(): Promise<ReturnType<typeof spawn>> {
  return new Promise((resolve, reject) => {
    const sshHost    = process.env.KDB_SSH_HOST!
    const sshUser    = process.env.KDB_SSH_USER!
    const sshKey     = process.env.KDB_SSH_KEY!
    const dbHost     = process.env.KDB_DB_HOST || 'mysql80.mediapartners.sakura.ne.jp'
    const localPort  = process.env.KDB_LOCAL_PORT || '13306'

    console.log(`  SSH トンネル起動中: ${sshUser}@${sshHost} → localhost:${localPort} → ${dbHost}:3306`)

    const tunnel = spawn('ssh', [
      '-i', sshKey,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ExitOnForwardFailure=yes',
      '-N',
      '-L', `${localPort}:${dbHost}:3306`,
      `${sshUser}@${sshHost}`,
    ])

    tunnel.stderr.on('data', (d: Buffer) => {
      const msg = d.toString().trim()
      if (msg) console.error('  [SSH]', msg)
    })

    tunnel.on('error', reject)

    // 2秒待ってトンネルが起動したとみなす
    setTimeout(() => resolve(tunnel), 2000)
  })
}

// ─── 日付変換 (YYYYMMDD → ISO 8601) ─────────────────────────

function toIso(yyyymmdd: string | null): string | null {
  if (!yyyymmdd) return null
  const s = String(yyyymmdd).replace(/\D/g, '')
  if (s.length !== 8) return null
  const date = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00+09:00`)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

// ─── KDBレコード → subsidies テーブル形式 ────────────────────

function mapRecord(r: KdbRecord) {
  const prefParts = [r.area2, r.area3].filter(Boolean)
  const prefecture = prefParts.length > 0 ? prefParts.join('') : null

  return {
    external_id:    `kdb_${r.id}`,
    title:          r.name,
    description:    r.project_description ?? null,
    catch_phrase:   null,
    target:         r.Subsidy_target ?? null,
    industry:       '共通_地域',
    prefecture,
    max_amount:     r.subsidy_limit ? Number(r.subsidy_limit) : null,
    subsidy_rate:   r.amount_remarks ?? null,
    deadline:       toIso(r.apply_end_date),
    accepted_at:    toIso(r.apply_start_date),
    url:            r.official_url ?? '',
    is_active:      true,
    source:         'kdb',
    last_synced_at: new Date().toISOString(),
  }
}

// ─── 埋め込みテキスト生成 ─────────────────────────────────────

function buildEmbeddingText(r: KdbRecord, prefecture: string | null): string {
  return [
    `補助金名: ${r.name}`,
    r.project_description  && `内容: ${r.project_description.slice(0, 1000)}`,
    r.Subsidy_target       && `対象: ${r.Subsidy_target}`,
    prefecture             && `地域: ${prefecture}`,
    r.search_keywords      && `キーワード: ${r.search_keywords}`,
    r.amount_remarks       && `補助内容: ${r.amount_remarks}`,
  ].filter(Boolean).join('\n')
}

// ─── KDB からレコード取得 ────────────────────────────────────

async function fetchKdbRecords(localPort: string, table: string): Promise<KdbRecord[]> {
  const mysql2 = await import('mysql2/promise')
  const conn = await mysql2.createConnection({
    host:     'localhost',
    port:     Number(localPort),
    database: process.env.KDB_DATABASE,
    user:     process.env.KDB_USER,
    password: process.env.KDB_PASSWORD,
    charset:  'utf8mb4',
  })

  const [rows] = await conn.execute(
    `SELECT * FROM \`${table}\` WHERE review_status = 'ok'`
  )
  await conn.end()
  return rows as KdbRecord[]
}

// ─── メイン ──────────────────────────────────────────────────

async function main() {
  const localPort = process.env.KDB_LOCAL_PORT || '13306'
  const table     = process.env.KDB_TABLE ?? 'subsidy_applications'

  // ── SSHトンネル起動 ──────────────────────────────────────────
  console.log('▶ SSHトンネル確立中...')
  const tunnel = await openTunnel()
  console.log('  トンネル起動完了')

  try {
    // ── KDB から ok レコード取得 ─────────────────────────────
    console.log('\n▶ KDB から ok レコードを取得中...')
    const records = await fetchKdbRecords(localPort, table)
    console.log(`  取得: ${records.length}件`)

    if (records.length === 0) {
      console.log('  対象レコードなし。終了。')
      return
    }

    // ── Supabase へ upsert ────────────────────────────────────
    console.log('\n▶ Supabase upsert 開始')
    const syncedIds: string[] = []

    for (const r of records) {
      const mapped = mapRecord(r)
      syncedIds.push(mapped.external_id)

      const { error } = await supabase
        .from('subsidies')
        .upsert(mapped, { onConflict: 'external_id' })

      if (error) {
        console.error(`  ✗ upsert失敗 id=kdb_${r.id}:`, error.message)
      } else {
        console.log(`  ✓ ${r.name.slice(0, 50)} [${mapped.prefecture ?? '全国'}]`)
      }
    }

    // ── 今回収集できなかった kdb レコードを inactive に ───────
    if (syncedIds.length > 0) {
      const ids = syncedIds.join(',')
      const { error } = await supabase
        .from('subsidies')
        .update({ is_active: false })
        .eq('source', 'kdb')
        .not('external_id', 'in', `(${ids})`)
        .not('external_id', 'is', null)

      if (error) {
        console.error('✗ kdb inactive更新エラー:', error.message)
      } else {
        console.log('\n▶ kdb 非公開分を inactive 化完了')
      }
    }

    // ── embedding 未生成の kdb レコードを処理 ─────────────────
    console.log('\n▶ 埋め込み生成開始')

    const { data: embeddedRows } = await supabase
      .from('subsidy_embeddings')
      .select('subsidy_id')
    const embeddedIds = new Set((embeddedRows ?? []).map(r => r.subsidy_id).filter(Boolean))

    const { data: targets } = await supabase
      .from('subsidies')
      .select('id, external_id')
      .eq('is_active', true)
      .eq('source', 'kdb')

    const toEmbed = (targets ?? []).filter(t => !embeddedIds.has(t.id))
    console.log(`  対象: ${toEmbed.length}件`)

    for (const t of toEmbed) {
      const kdbId = Number(t.external_id.replace('kdb_', ''))
      const r = records.find(r => r.id === kdbId)
      if (!r) continue

      const prefParts = [r.area2, r.area3].filter(Boolean)
      const prefecture = prefParts.length > 0 ? prefParts.join('') : null
      const text = buildEmbeddingText(r, prefecture)

      let vec: number[]
      try {
        vec = await generateEmbedding(text)
      } catch (e) {
        console.error(`  ✗ embedding失敗 kdb_${r.id}:`, (e as Error).message)
        continue
      }

      const { error } = await supabase
        .from('subsidy_embeddings')
        .upsert(
          { subsidy_id: t.id, embedding: vec, embedded_text: text },
          { onConflict: 'subsidy_id' }
        )

      if (error) {
        console.error(`  ✗ embedding upsert失敗 kdb_${r.id}:`, error.message)
      } else {
        console.log(`  ✓ ${r.name.slice(0, 50)}`)
      }
    }

    console.log('\n✅ KDB 同期完了')

  } finally {
    tunnel.kill()
    console.log('  SSHトンネルを閉じました')
  }
}

main().catch(err => {
  console.error('\n❌ KDB 同期失敗:', err)
  process.exit(1)
})

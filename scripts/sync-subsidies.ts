/**
 * scripts/sync-subsidies.ts
 *
 * jGrants API → Supabase 週次同期スクリプト
 * 実行: npx tsx scripts/sync-subsidies.ts
 *
 * 必要な環境変数:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '../src/lib/llm'

// ─── 設定 ────────────────────────────────────────────────────

const JGRANTS_BASE = 'https://api.jgrants-portal.go.jp/exp/v1/public'
const RATE_LIMIT_MS = 1100  // jGrants: 60req/min → 1req/sec + バッファ
const PAGE_LIMIT    = 100   // 1リクエストあたり最大取得件数
const MAX_PAGES     = 5     // 1キーワードあたり最大ページ数 (=最大500件)

/**
 * 収集対象の業種とキーワード設定
 * 対面サービス業（飲食・宿泊・理美容・小売）向けに広くカバー
 */
const SYNC_TARGETS = [
  {
    industry: '飲食業',
    keywords: ['飲食', '飲食店', '飲食業', '食品', '食品衛生', 'フードビジネス', '受動喫煙'],
  },
  {
    industry: '宿泊業',
    keywords: ['宿泊', 'ホテル', '旅館', '民泊', '観光', 'インバウンド'],
  },
  {
    industry: '理美容業',
    keywords: ['美容', '理容', 'サロン', '理美容', 'エステ', 'ネイル'],
  },
  {
    industry: '小売業',
    keywords: ['小売', '商店', '商店街', '販売', '物販'],
  },
  {
    industry: '共通_IT',
    keywords: [
      'IT導入',          // IT導入補助金(超重要)
      'デジタル化',
      'DX',
      'ホームページ',
      'POSシステム',
      'キャッシュレス',
      'EC',
      'オンライン',
    ],
  },
  {
    industry: '共通_経営',
    keywords: [
      '小規模事業者',    // 小規模持続化補助金(超重要)
      '持続化',
      '販路開拓',        // 持続化補助金の目的
      '中小企業',        // 幅広い中小企業向け補助金
      '創業',
      '事業承継',
      '経営改善',
      '人材育成',
      '雇用',
    ],
  },
  {
    industry: '共通_設備',
    keywords: [
      '省エネ',
      '設備導入',
      '脱炭素',
      '再生可能エネルギー',
      '太陽光',
      '空調',
    ],
  },
  {
    industry: '共通_改装',
    keywords: [
      '内装',            // 店舗内装工事
      '改装',            // 店舗改装全般
      'リノベーション',
      '店舗改修',
      '改修',
      'バリアフリー',    // 改修系補助金に多い
    ],
  },
]

// ─── クライアント初期化 ──────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── ユーティリティ ──────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── jGrants API 呼び出し ─────────────────────────────────────

async function fetchSubsidyList(keyword: string): Promise<any[]> {
  const allItems: any[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      keyword,
      acceptance: '1',             // 募集中のみ
      sort:       'created_date',
      order:      'DESC',
      limit:      String(PAGE_LIMIT),
      offset:     String(page * PAGE_LIMIT),
    })
    const res = await fetch(`${JGRANTS_BASE}/subsidies?${params}`)
    if (!res.ok) throw new Error(`jGrants list API error: ${res.status} keyword="${keyword}"`)
    const json = await res.json()
    const items = json.result ?? []
    allItems.push(...items)

    // 取得件数が PAGE_LIMIT 未満なら最終ページ
    if (items.length < PAGE_LIMIT) break

    await sleep(RATE_LIMIT_MS)
  }

  return allItems
}

async function fetchSubsidyDetail(id: string): Promise<any> {
  const res = await fetch(`${JGRANTS_BASE}/subsidies/id/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`jGrants detail API error: ${res.status} id=${id}`)
  const json = await res.json()
  // 詳細APIはオブジェクト直接 or result[0] の場合がある
  return Array.isArray(json.result) ? json.result[0] : (json.result ?? json)
}

// ─── データマッピング ─────────────────────────────────────────

function mapToRecord(item: any, detail: any, industry: string) {
  const merged = { ...item, ...detail }
  return {
    external_id:    merged.id,
    title:          merged.title ?? merged.name ?? '',
    description:    merged.detail ?? null,
    catch_phrase:   merged.subsidy_catch_phrase ?? null,
    target:         merged.use_purpose ?? null,
    industry,
    prefecture:     merged.target_area_search ?? null,
    max_amount:     merged.subsidy_max_limit != null ? Number(merged.subsidy_max_limit) : null,
    subsidy_rate:   merged.subsidy_rate ?? null,
    deadline:       merged.acceptance_end_datetime ?? null,
    accepted_at:    merged.acceptance_start_datetime ?? null,
    url:            `https://jgrants-portal.go.jp/subsidy/${merged.id}`,
    is_active:      true,
    last_synced_at: new Date().toISOString(),
  }
}

// ─── 埋め込みテキスト生成 ─────────────────────────────────────

function buildEmbeddingText(s: {
  title: string
  catch_phrase?: string | null
  description?: string | null
  target?: string | null
  industry?: string | null
  prefecture?: string | null
  max_amount?: number | null
  subsidy_rate?: string | null
}): string {
  return [
    `補助金名: ${s.title}`,
    s.catch_phrase  && `概要: ${s.catch_phrase}`,
    s.description   && `内容: ${s.description.slice(0, 2000)}`,
    s.target        && `対象・用途: ${s.target}`,
    s.industry      && `業種: ${s.industry}`,
    s.prefecture    && `地域: ${s.prefecture}`,
    s.max_amount    && `最大補助額: ${s.max_amount.toLocaleString()}円`,
    s.subsidy_rate  && `補助率: ${s.subsidy_rate}`,
  ].filter(Boolean).join('\n')
}

// ─── メイン処理 ──────────────────────────────────────────────

async function main() {
  const syncedExternalIds = new Set<string>()

  // ── Step 1: jGrants から収集して upsert ──
  for (const target of SYNC_TARGETS) {
    console.log(`\n▶ [${target.industry}] 収集開始`)
    const industryIds = new Set<string>()

    for (const keyword of target.keywords) {
      console.log(`  キーワード: "${keyword}"`)
      const items = await fetchSubsidyList(keyword)
      await sleep(RATE_LIMIT_MS)

      for (const item of items) {
        if (industryIds.has(item.id)) continue // 同業種内の重複スキップ
        industryIds.add(item.id)
        syncedExternalIds.add(item.id)

        // 詳細取得
        let detail: any = {}
        try {
          detail = await fetchSubsidyDetail(item.id)
          await sleep(RATE_LIMIT_MS)
        } catch (e) {
          console.warn(`    ⚠ 詳細取得失敗 id=${item.id}:`, (e as Error).message)
        }

        const record = mapToRecord(item, detail, target.industry)
        const { error } = await supabase
          .from('subsidies')
          .upsert(record, { onConflict: 'external_id' })

        if (error) {
          console.error(`    ✗ upsert失敗 id=${item.id}:`, error.message)
        } else {
          console.log(`    ✓ ${record.title.slice(0, 50)}`)
        }
      }
    }

    console.log(`  → ${industryIds.size}件 upsert完了`)
  }

  // ── Step 2: 今回収集できなかった既存レコードを inactive に ──
  if (syncedExternalIds.size > 0) {
    // PostgREST の in フィルタはクォートなし: (id1,id2,...)
    const ids = [...syncedExternalIds].join(',')
    const { error } = await supabase
      .from('subsidies')
      .update({ is_active: false })
      .eq('source', 'jgrants')
      .not('external_id', 'in', `(${ids})`)
      .not('external_id', 'is', null)

    if (error) {
      console.error('\n✗ inactive更新エラー:', error.message)
    } else {
      console.log('\n▶ 募集終了分を inactive 化完了')
    }
  }

  // ── Step 3: 埋め込み未生成の active 補助金を処理 ──
  console.log('\n▶ 埋め込み生成開始')

  // 埋め込み済みの subsidy_id を先に取得
  const { data: embeddedRows } = await supabase
    .from('subsidy_embeddings')
    .select('subsidy_id')
  const embeddedIds = (embeddedRows ?? []).map(r => r.subsidy_id).filter(Boolean)

  // 埋め込み未生成の active 補助金を取得 (空配列フィルタは不要なのでスキップ)
  let query = supabase
    .from('subsidies')
    .select('id, title, catch_phrase, description, target, industry, prefecture, max_amount, subsidy_rate')
    .eq('is_active', true)

  if (embeddedIds.length > 0) {
    query = query.not('id', 'in', `(${embeddedIds.join(',')})`)
  }

  const { data: targets, error: fetchErr } = await query

  if (fetchErr) {
    console.error('埋め込み対象取得エラー:', fetchErr.message)
    process.exit(1)
  }

  const embeddingTargets = targets ?? []
  console.log(`  対象: ${embeddingTargets.length}件`)

  for (const subsidy of embeddingTargets) {
    const text = buildEmbeddingText(subsidy as any)

    let embeddingVec: number[]
    try {
      embeddingVec = await generateEmbedding(text)
    } catch (e) {
      console.error(`  ✗ embedding生成失敗 id=${subsidy.id}:`, (e as Error).message)
      continue
    }

    const { error: upsertErr } = await supabase
      .from('subsidy_embeddings')
      .upsert(
        { subsidy_id: subsidy.id, embedding: embeddingVec, embedded_text: text },
        { onConflict: 'subsidy_id' }
      )

    if (upsertErr) {
      console.error(`  ✗ embedding upsert失敗 id=${subsidy.id}:`, upsertErr.message)
    } else {
      console.log(`  ✓ ${subsidy.title.slice(0, 50)}`)
    }
  }

  console.log('\n✅ 同期完了')
}

main().catch(err => {
  console.error('\n❌ 同期失敗:', err)
  process.exit(1)
})

/**
 * scripts/extract-prompts.mjs
 *
 * ai-training.media-partners.co.jp/prompt/ から全プロンプトを抽出する。
 * 仕組み: フォームに cate_1(大分類) + cate_2(小分類=プロンプトID) を POST すると
 *         サーバが該当プロンプト1件を <li class="prompt-item" data-prompt1=...> で描画する。
 *         data-cate2 属性に 大分類→{小分類ID:タイトル} の全マッピングがあるので
 *         全ペアを巡回して data-prompt1 / data-prompt2 / data-explanation を回収する。
 *
 * 実行: node scripts/extract-prompts.mjs
 * 出力: prompts-extracted.json  /  prompts-extracted.md
 */

import { writeFileSync, readFileSync } from 'node:fs'

const BASE = 'https://ai-training.media-partners.co.jp/prompt/'
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const CONCURRENCY = 6

// ── HTMLエンティティのデコード ───────────────────────────────
function decodeEntities(s) {
  if (!s) return ''
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

// ── 1件のプロンプトを取得 ────────────────────────────────────
async function fetchPrompt(cate1, cate2) {
  const body = `cate_1=${encodeURIComponent(cate1)}&cate_2=${encodeURIComponent(cate2)}`
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      'Referer': BASE,
    },
    body,
  })
  const html = await res.text()

  // <li id="prompt-XX" class="prompt-item" data-prompt1="..." data-prompt2="..." data-explanation="...">preview</li>
  const m = html.match(
    /<li[^>]*id="(prompt-[0-9]+)"[^>]*class="prompt-item"[^>]*data-prompt1="([\s\S]*?)"\s+data-prompt2="([\s\S]*?)"\s+data-explanation="([\s\S]*?)"\s*>/
  )
  if (!m) return null
  return {
    promptId:    m[1],
    prompt1:     decodeEntities(m[2]).trim(),
    prompt2:     decodeEntities(m[3]).trim(),
    explanation: decodeEntities(m[4]).trim(),
  }
}

// ── 簡易並列プール ───────────────────────────────────────────
async function pool(items, worker, concurrency) {
  const results = new Array(items.length)
  let idx = 0
  async function run() {
    while (idx < items.length) {
      const cur = idx++
      results[cur] = await worker(items[cur], cur)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run))
  return results
}

async function main() {
  // 大分類ラベル + data-cate2 を base ページから取得
  console.log('▶ base ページ取得...')
  const baseHtml = await (await fetch(BASE, { headers: { 'User-Agent': UA } })).text()

  // 大分類ラベル
  const cate1Labels = {}
  const selMatch = baseHtml.match(/<select id="cate_1"[\s\S]*?<\/select>/)
  if (selMatch) {
    for (const o of selMatch[0].matchAll(/<option value="([0-9]+)"[^>]*>([^<]*)<\/option>/g)) {
      cate1Labels[o[1]] = o[2].trim()
    }
  }

  // data-cate2（大分類→{小分類ID:タイトル}）
  const cate2Raw = baseHtml.match(/data-cate2='([^']*)'/)[1]
  const cate2Map = JSON.parse(decodeEntities(cate2Raw))

  // 全ペアを展開
  const pairs = []
  for (const c1 of Object.keys(cate2Map)) {
    for (const [c2, title] of Object.entries(cate2Map[c1])) {
      pairs.push({ cate1: c1, cate2: c2, title, cate1Label: cate1Labels[c1] ?? c1 })
    }
  }
  console.log(`▶ 大分類 ${Object.keys(cate2Map).length}件 / プロンプト ${pairs.length}件 を抽出開始（並列${CONCURRENCY}）\n`)

  let done = 0
  const rows = await pool(pairs, async (p) => {
    let data = null
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      try { data = await fetchPrompt(p.cate1, p.cate2) }
      catch { await new Promise(r => setTimeout(r, 400)) }
    }
    done++
    if (done % 25 === 0 || done === pairs.length) {
      process.stdout.write(`\r  ${done}/${pairs.length}`)
    }
    return { ...p, ...(data ?? { promptId: null, prompt1: '', prompt2: '', explanation: '', error: true }) }
  }, CONCURRENCY)
  console.log('\n')

  const ok   = rows.filter(r => r.prompt1)
  const fail = rows.filter(r => !r.prompt1)
  console.log(`✓ 取得成功: ${ok.length}件 / 失敗: ${fail.length}件`)
  if (fail.length) console.log('  失敗ペア:', fail.map(f => `${f.cate1}/${f.cate2}`).join(', '))

  // JSON 出力
  writeFileSync('prompts-extracted.json', JSON.stringify(rows, null, 2), 'utf8')

  // Markdown 出力（大分類ごと）
  let md = `# 抽出プロンプト一覧（${ok.length}件）\n\n出典: ${BASE}\n\n`
  const byCate = {}
  for (const r of ok) (byCate[r.cate1Label] ??= []).push(r)
  for (const [label, list] of Object.entries(byCate)) {
    md += `\n## ${label}（${list.length}件）\n\n`
    for (const r of list) {
      md += `### ${r.title}\n\n`
      if (r.explanation) md += `**説明:** ${r.explanation}\n\n`
      md += '**プロンプト1:**\n\n```\n' + r.prompt1 + '\n```\n\n'
      if (r.prompt2) md += '**プロンプト2:**\n\n```\n' + r.prompt2 + '\n```\n\n'
    }
  }
  writeFileSync('prompts-extracted.md', md, 'utf8')

  console.log('\n✅ 出力: prompts-extracted.json / prompts-extracted.md')
}

main().catch(e => { console.error('❌', e); process.exit(1) })

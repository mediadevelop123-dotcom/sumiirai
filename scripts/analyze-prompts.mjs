/**
 * scripts/analyze-prompts.mjs — 抽出プロンプトの機械的品質分析
 * 実行: node scripts/analyze-prompts.mjs
 */
import { readFileSync } from 'node:fs'

const rows = JSON.parse(readFileSync('prompts-extracted.json', 'utf8')).filter(r => r.prompt1)
const N = rows.length
const pct = n => `${(n / N * 100).toFixed(1)}%`
console.log(`\n=== 対象: ${N}件 ===\n`)

// ── 1. カテゴリ分布 ──────────────────────────────────────────
const byCat = {}
for (const r of rows) (byCat[r.cate1Label] ??= []).push(r)
const cats = Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)
console.log('── カテゴリ分布（37分類）──')
for (const [c, l] of cats) console.log(`  ${String(l.length).padStart(3)}  ${c}`)
console.log(`  最多 ${cats[0][1].length} / 最少 ${cats[cats.length-1][1].length} 件`)

// ── 2. 文字数分布 ────────────────────────────────────────────
const lens = rows.map(r => r.prompt1.length).sort((a, b) => a - b)
const q = p => lens[Math.floor(lens.length * p)]
console.log('\n── 本文文字数 ──')
console.log(`  min ${lens[0]} / 中央 ${q(0.5)} / 平均 ${Math.round(lens.reduce((a,b)=>a+b,0)/N)} / 90%点 ${q(0.9)} / max ${lens[lens.length-1]}`)
const thin = rows.filter(r => r.prompt1.length < 40)
console.log(`  薄い(<40字): ${thin.length}件 ${pct(thin.length)}`)
thin.slice(0, 12).forEach(r => console.log(`     [${r.cate1Label}] ${r.title} → "${r.prompt1.replace(/\n/g,' ').slice(0,50)}"`))

// ── 3. タイトル≒本文（手抜き）──────────────────────────────
const norm = s => s.replace(/\s+/g, '').replace(/[「」【】、。・,.:：]/g, '')
const titleEchoes = rows.filter(r => {
  const t = norm(r.title), p = norm(r.prompt1)
  return p.length < t.length * 1.5 && p.includes(t.slice(0, Math.min(t.length, 10)))
})
console.log(`\n── タイトルをほぼ反復しただけ: ${titleEchoes.length}件 ${pct(titleEchoes.length)} ──`)
titleEchoes.slice(0, 8).forEach(r => console.log(`     [${r.cate1Label}] ${r.title}`))

// ── 4. 重複・ニアミス ────────────────────────────────────────
const seen = new Map()
let exactDup = 0
for (const r of rows) {
  const k = norm(r.prompt1)
  if (seen.has(k)) { exactDup++; } else seen.set(k, r)
}
console.log(`\n── 本文の完全重複: ${exactDup}件 ──`)
// タイトル重複
const titleMap = {}
for (const r of rows) (titleMap[r.title] ??= []).push(r)
const dupTitles = Object.entries(titleMap).filter(([, l]) => l.length > 1)
console.log(`── 同一タイトルが複数カテゴリに: ${dupTitles.length}種 ──`)
dupTitles.slice(0, 8).forEach(([t, l]) => console.log(`     "${t}" ×${l.length}（${l.map(x=>x.cate1Label).join(' / ')}）`))

// ── 5. プレースホルダ様式 ────────────────────────────────────
const ph = {
  '【】':   rows.filter(r => /【[^】]+】/.test(r.prompt1)).length,
  '[]':     rows.filter(r => /\[[^\]]+\]/.test(r.prompt1)).length,
  '〇〇/○○': rows.filter(r => /〇〇|○○|◯◯/.test(r.prompt1)).length,
  '{{}}':   rows.filter(r => /\{\{?[^}]+\}\}?/.test(r.prompt1)).length,
  '＜＞/<>': rows.filter(r => /[＜<][^＞>]+[＞>]/.test(r.prompt1)).length,
}
console.log('\n── プレースホルダ様式（混在＝不統一）──')
for (const [k, v] of Object.entries(ph)) console.log(`  ${k}: ${v}件 ${pct(v)}`)
const noPh = rows.filter(r => !/【[^】]+】|\[[^\]]+\]|〇〇|○○|\{\{|[＜][^＞]+[＞]/.test(r.prompt1))
console.log(`  プレースホルダ無し（汎用文のみ）: ${noPh.length}件 ${pct(noPh.length)}`)

// ── 6. 対面サービス業との関連度 ──────────────────────────────
const svcWords = /飲食|レストラン|カフェ|居酒屋|美容|理容|ヘア|サロン|ネイル|エステ|小売|店舗|店長|接客|来店|宿泊|ホテル|旅館|予約|メニュー|常連|スタッフ|アルバイト|パート|POP|チラシ|口コミ|販促/
const svc = rows.filter(r => svcWords.test(r.prompt1) || svcWords.test(r.title))
console.log(`\n── 対面サービス業に関係しそう: ${svc.length}件 ${pct(svc.length)} ──`)
const svcByCat = {}
for (const r of svc) svcByCat[r.cate1Label] = (svcByCat[r.cate1Label]||0)+1
Object.entries(svcByCat).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([c,n])=>console.log(`     ${String(n).padStart(3)}  ${c}`))

// ── 7. 文字化け・HTML残骸 ────────────────────────────────────
const broken = rows.filter(r => /&[a-z]+;|&#\d+;|<\/?[a-z]+>|�/i.test(r.prompt1))
console.log(`\n── 文字化け/HTML残骸の疑い: ${broken.length}件 ──`)
broken.slice(0, 5).forEach(r => console.log(`     [${r.cate1Label}] ${r.title}`))

console.log('\n=== 分析完了 ===\n')

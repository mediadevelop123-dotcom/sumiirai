/**
 * scripts/gen-business-templates.mjs
 * prompts-final.json → src/lib/business-templates.ts を生成。
 * 既存の BUSINESS_TEMPLATES と同じ { category, items:[{label,q}] } 形式。
 * label=短縮タイトル / q=プロンプト本文（prompt2 がある場合は区切って連結）。
 * 実行: node scripts/gen-business-templates.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const rows = JSON.parse(readFileSync('prompts-final.json', 'utf8'))

// タブ表示順
const TAB_ORDER = ['集客・SNS', '販促・広告物', '接客・顧客対応', '採用・スタッフ', 'メール・文書', '経営・業務改善']

// ラベル短縮：先頭の【…】タグ・前後の引用符を除去し、長すぎれば省略
function shortLabel(title) {
  let s = title.replace(/^【[^】]*】/, '').replace(/^[「『"“]/,'').replace(/["”』」]$/,'').trim()
  // 末尾の冗長語を軽く除去
  s = s.replace(/(のプロンプト|プロンプト)$/,'').trim()
  if (s.length > 24) s = s.slice(0, 23) + '…'
  return s
}

// 本文：prompt2 があれば区切りを入れて連結
function buildQ(r) {
  if (!r.prompt2) return r.prompt1
  return `${r.prompt1}\n\n───────────────\n【▼ 上の回答を得たあと、続けて以下を送信してください（プロンプト2）】\n\n${r.prompt2}`
}

const esc = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

let out = `// src/lib/business-templates.ts
// 自動生成: scripts/gen-business-templates.mjs（prompts-final.json より）
// 経営・業務アシストタブ用テンプレート。label=表示名 / q=入力欄に投入する本文。
// 手編集する場合はこのファイルを直接編集してよい（再生成すると上書きされる点に注意）。

export interface BusinessTemplateItem {
  label: string
  q: string
}
export interface BusinessTemplateCategory {
  category: string
  items: BusinessTemplateItem[]
}

export const BUSINESS_TEMPLATES: BusinessTemplateCategory[] = [
`

for (const tab of TAB_ORDER) {
  const list = rows.filter(r => r.tab === tab)
  if (!list.length) continue
  out += `  { category: '${tab}', items: [\n`
  for (const r of list) {
    out += `    { label: '${esc(shortLabel(r.title))}', q: \`${esc(buildQ(r))}\` },\n`
  }
  out += `  ]},\n`
}
out += `]\n`

writeFileSync('src/lib/business-templates.ts', out, 'utf8')

const counts = {}
for (const r of rows) counts[r.tab] = (counts[r.tab]||0)+1
console.log('✅ src/lib/business-templates.ts を生成')
console.log(`   ${rows.length}件 / ${Object.keys(counts).length}カテゴリ`)
for (const t of TAB_ORDER) if (counts[t]) console.log(`     ${String(counts[t]).padStart(2)}  ${t}`)

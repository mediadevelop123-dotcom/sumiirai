/**
 * scripts/finalize-prompts.mjs
 * キュレーション候補82件 → 手選別の確定リスト（45〜55件）を生成。
 * ・allow-list（タイトル一致）で採用、必要に応じてタブ再配置
 * ・本文は原文ママ。プレースホルダ記法のみ【】に統一
 * ・prompt2 付きも保持（2段表示用）
 * 出力: prompts-final.json / prompts-final-review.md
 * 実行: node scripts/finalize-prompts.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const rows = JSON.parse(readFileSync('prompts-curated.json', 'utf8'))
const byTitle = new Map(rows.map(r => [r.title, r]))

// ── 採用リスト（title, tab?=再配置先）──────────────────────
const KEEP = [
  // 集客・SNS
  { t: '業種と目的に応じたLINE公式アカウントのリッチメニュー案の作成' },
  { t: 'Instagramの投稿内容の提案' },
  { t: 'Facebook投稿を半自動で生成する' },
  { t: '【クリエイティブ業界向け】SNSに載せたくなる“チラシ写真”設計プロンプト' },
  { t: 'X（Twitter）運用を効率化する', tab: '集客・SNS' },

  // 販促・広告物
  { t: 'コンバージョンに繋がるリスティング広告文を量産' },
  { t: '誰でもカンタンにPOPができちゃうプロンプト' },
  { t: '質の高いLP構成案の作成する' },
  { t: '【クリエイティブ業界向け】「手に取る前提」の一言キャッチ案生成プロンプト' },
  { t: '【クリエイティブ業界向け】チラシの“共感導入文”生成プロンプト' },
  { t: '【クリエイティブ業界向け】チラシやパンフレットなど両面印刷の情報分離構成のプロンプト' },
  { t: '【クリエイティブ業界向け】捨てられないチラシの作成アイデアを出すプロンプト' },
  { t: '【クリエイティブ業界向け】サービスの“擬人化キャラ設定”プロンプト' },
  { t: '【クリエイティブ業界向け】ターゲットの“動線”を想定した紙面レイアウト設計プロンプト' },
  { t: 'ターゲットの心を鷲掴みにする、刺さる広告コピーを自動生成', tab: '販促・広告物' },
  { t: '【クリエイティブ業界向け】QRコード／CTAの配置とトーン提案プロンプト', tab: '販促・広告物' },
  { t: '【クリエイティブ業界向け】「切り抜きたくなる一言」ミーム風コピー生成プロンプト', tab: '販促・広告物' },

  // 接客・顧客対応
  { t: '顧客満足度向上のための施策を提案してもらうプロンプト' },
  { t: '日報テンプレートの作成する' },
  { t: 'FAQを作成するプロンプト' },
  { t: 'クレーム対応のための効果的なトレーニング' },
  { t: '顧客対応スクリプトの改善' },
  { t: 'お客様のレビューやコメントから本音（感情）を読み解く分析プロンプト' },
  { t: '顧客ロイヤルティプログラムの設計支援' },
  { t: '高品質アンケート自動設計プロンプト' },
  { t: 'アンケート結果から課題と改善点を整理するプロンプト' },

  // 採用・スタッフ
  { t: '【候補者の本質を見抜く】プロフィールから、深掘りするための面接質問を自動生成' },
  { t: '募集ポジションの要件を入れるだけ！評価基準が揃う面接質問テンプレート' },
  { t: 'チームの成果評価とフィードバック支援' },
  { t: '新人教育カリキュラム作成' },
  { t: '個人のモチベーションUP施策と悩みヒント提案プロンプト' },
  { t: '【クリエイティブ業界向け】スタッフが着たくなるTシャツ文字生成プロンプト' },
  { t: '従業員シフト作成プロンプト' },

  // メール・文書
  { t: 'ビジネスメールをChatGPTを作成する' },
  { t: 'お礼のビジネスメール作成用のプロンプト' },
  { t: '日程調整に対するメール返信効率化プロンプト' },
  { t: 'クライアントへの第一印象を良くするメールテンプレート' },
  { t: '受信メール・チャットへのプロフェッショナルな返信文生成プロンプト' },
  { t: 'あらゆるシーンに対応！最適な社内報告書フォーマットを作成' },
  { t: '議事録作成プロンプト' },
  { t: '会議案内文を作成するプロンプト' },
  { t: 'メルマガの開封率を上げるタイトルを作成する', tab: 'メール・文書' },
  { t: '正しい敬語を使った文章に修正する', tab: 'メール・文書' },

  // 経営・業務改善
  { t: '商談のクロージングでよくある反論とその切り返し例を考えるプロンプト' },
  { t: '魅力的なサービス説明文を自動生成' },
  { t: '多様な視点に基づくアイデア創出プロンプト' },
  { t: '効率的に後回しにできるタスクを見つけ出すプロンプト' },
  { t: '施策検討のための意見生成プロンプト' },
  { t: '会議のテーマに沿った具体的な議題を考える', tab: '経営・業務改善' },
]

// ── プレースホルダを【】に統一 ───────────────────────────────
function normalizePlaceholders(text) {
  if (!text) return text
  let s = text
  // {{ xxx }} → 【xxx】
  s = s.replace(/\{\{\s*([^{}]{1,80}?)\s*\}\}/g, '【$1】')
  // { xxx } → 【xxx】（説明的な中身があるもののみ）
  s = s.replace(/\{\s*([^{}]{1,80}?)\s*\}/g, '【$1】')
  // [ xxx ] → 【xxx】
  s = s.replace(/\[\s*([^\[\]]{1,80}?)\s*\]/g, '【$1】')
  // ＜xxx＞ / <xxx>（日本語の中身があるもの）→ 【xxx】
  s = s.replace(/[＜<]\s*([^＜＞<>]{1,60}?[ぁ-んァ-ン一-龥][^＜＞<>]{0,60}?)\s*[＞>]/g, '【$1】')
  // 〇〇 / ○○ / ◯◯（空欄プレースホルダ）→ 【　】
  s = s.replace(/[〇○◯]{2,}/g, '【　】')
  return s
}

// ── 確定リスト構築 ───────────────────────────────────────────
const final = []
const missing = []
for (const k of KEEP) {
  const r = byTitle.get(k.t)
  if (!r) { missing.push(k.t); continue }
  final.push({
    title:       r.title,
    tab:         k.tab ?? r.tab,
    prompt1:     normalizePlaceholders(r.prompt1),
    prompt2:     normalizePlaceholders(r.prompt2 || ''),
    explanation: r.explanation || '',
    sourceCate:  r.cate1Label,
    promptId:    r.promptId,
  })
}

if (missing.length) {
  console.log('⚠ 未マッチ（タイトル要確認）:')
  missing.forEach(m => console.log('   -', m))
  console.log()
}

const TAB_ORDER = ['集客・SNS', '販促・広告物', '接客・顧客対応', '採用・スタッフ', 'メール・文書', '経営・業務改善']
final.sort((a, b) => TAB_ORDER.indexOf(a.tab) - TAB_ORDER.indexOf(b.tab))

const counts = {}
for (const r of final) counts[r.tab] = (counts[r.tab] || 0) + 1
console.log(`=== 確定: ${final.length}件 ===`)
for (const t of TAB_ORDER) console.log(`  ${String(counts[t] || 0).padStart(2)}  ${t}`)
console.log(`  （うち prompt2 付き: ${final.filter(r => r.prompt2).length}件）`)

// プレースホルダ統一後の残存チェック
const leftover = final.filter(r => /\[[^\]]+\]|\{\{|[〇○◯]{2,}/.test(r.prompt1 + r.prompt2))
console.log(`  プレースホルダ未変換が残る可能性: ${leftover.length}件`)
leftover.forEach(r => console.log(`     - ${r.title}`))

writeFileSync('prompts-final.json', JSON.stringify(final, null, 2), 'utf8')

let md = `# 確定プロンプト（${final.length}件）\n\n対面サービス業向け・手選別済み。本文は原文ママ、プレースホルダは【】統一。\n`
for (const t of TAB_ORDER) {
  const list = final.filter(r => r.tab === t)
  md += `\n## ${t}（${list.length}件）\n\n`
  for (const r of list) {
    md += `### ${r.title}\n\n`
    if (r.explanation) md += `*${r.explanation}*\n\n`
    md += '**プロンプト1:**\n\n```\n' + r.prompt1 + '\n```\n\n'
    if (r.prompt2) md += '**プロンプト2:**\n\n```\n' + r.prompt2 + '\n```\n\n'
    md += `<sub>出典カテゴリ: ${r.sourceCate} / ${r.promptId}</sub>\n\n`
  }
}
writeFileSync('prompts-final-review.md', md, 'utf8')
console.log('\n✅ 出力: prompts-final.json / prompts-final-review.md')

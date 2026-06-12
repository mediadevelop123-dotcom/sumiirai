/**
 * scripts/curate-prompts.mjs
 * 抽出524件を対面サービス業（飲食・理美容・小売・宿泊）向けにキュレーション。
 * ①用途カテゴリへの自動仕分け ②関連度スコア ③オフドメイン除外
 * 出力: prompts-curated.json / prompts-curated-review.md（タイトル一覧で目視レビュー用）
 * 実行: node scripts/curate-prompts.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const rows = JSON.parse(readFileSync('prompts-extracted.json', 'utf8')).filter(r => r.prompt1)

// ── 明らかに対象外の大分類（小規模対面サービス業に無関係）──
const OFFDOMAIN_CATS = new Set([
  '不動産関連', '金融・銀行関連', '士業関連', 'システム開発',
  'データ分析・レポート作成', 'プロンプトエンジニアリング',
  '情報検証・ファクトチェック', '財務・会計', '財務関連',
])

// ── BtoB/大企業専用シグナル（小規模店舗には過剰）──
const ENTERPRISE = /SaaS|BtoB|B2B|上場|IR情報|M&A|与信|融資審査|サプライチェーン|エンジニア採用|API|データベース|KPIツリー|事業ポートフォリオ|IPO|株主|決算説明/

// ── 店主に無関係なノイズ（タイトルで除外）──
const TITLE_EXCLUDE = /画像生成|サムネイル|パース|DALL-?E|ビジュアル生成|アイコン|WEBデザイナー|Webサイト作成|ファッションデザイン|ZINE|建築|新規市場|市場進出|事業計画書|MVP|6-?Step|カスタマージャーニー|スキルマッピング|リーダーシップトレーニング|キャリアパス|ことわざ|慣用句|海外からの印象|ビジネス本|ケーススタディ|フレームワーク|PASTOR|PASONA|PASTR|ペルソナを指定|MEO|記事アウトライン|記事の構成|ブログ|YouTube/

// ── 用途カテゴリ定義（aizoo-solo 業務タブ）──
// 順序＝優先度。先にマッチしたものを採用。
const TABS = [
  { key: '集客・SNS', re: /SNS|Instagram|インスタ|LINE|TikTok|ティックトック|X（旧Twitter|ツイート|投稿文|ハッシュタグ|フォロワー|口コミ|レビュー返信|Googleビジネス|MEO/ },
  { key: '販促・広告物', re: /POP|チラシ|パンフ|キャッチコピー|キャッチコ|メニュー表|DM|ポスター|看板|店頭|販促|セールスコピー|ランディング|LP|広告文|バナー/ },
  { key: '接客・顧客対応', re: /クレーム|お詫び|謝罪|FAQ|問い合わせ|問合せ|顧客対応|接客|カスタマー|苦情|返答文|お客様|アンケート|満足度|常連|リピート/ },
  { key: '採用・スタッフ', re: /求人|採用|面接|評価シート|人事評価|スタッフ|アルバイト|パート|シフト|マニュアル|研修|育成|オンボーディング|1on1|フィードバック|モチベーション/ },
  { key: 'メール・文書', re: /メール|挨拶|お礼|案内文|議事録|報告書|お知らせ|社内連絡|文書|稟議|依頼文|テンプレート.*文|ビジネス文/ },
  { key: '経営・業務改善', re: /業務改善|効率化|タスク|計画|アイデア|価格設定|値付け|売上|コスト|集客施策|キャンペーン|企画|戦略|分析コメント|新メニュー|新サービス/ },
]

// ── サービス業を直接示すキーワード（スコア加点）──
const SVC = /飲食|レストラン|カフェ|居酒屋|バー|美容室|理容|ヘアサロン|ネイル|エステ|サロン|小売|店舗|店長|来店|接客|宿泊|ホテル|旅館|民宿|メニュー|口コミ|POP|チラシ|販促|常連|予約|店頭|地域|個人店|お店/

// 集客・販促・経営系は「店舗向け」でないと汎用BtoBが紛れるため、サービス関連を必須にする
const SVC_REQUIRED_TABS = new Set(['集客・SNS', '販促・広告物', '経営・業務改善'])
// 普遍的な小規模店舗オペ（サービス語が無くても採用してよい）
const UNIVERSAL_TABS = new Set(['接客・顧客対応', '採用・スタッフ', 'メール・文書'])

function scoreRow(r) {
  if (OFFDOMAIN_CATS.has(r.cate1Label)) return null
  if (TITLE_EXCLUDE.test(r.title)) return null
  const gateText = r.title + '\n' + r.prompt1
  if (ENTERPRISE.test(gateText)) return null

  // 用途タブ判定：タイトル優先（本文の例文に引っ張られないように）
  let tab = null
  for (const t of TABS) { if (t.re.test(r.title)) { tab = t.key; break } }
  if (!tab) { // タイトルで決まらなければ本文で最多マッチ
    let best = 0
    for (const t of TABS) {
      const hits = (gateText.match(new RegExp(t.re, 'g')) || []).length
      if (hits > best) { best = hits; tab = t.key }
    }
  }
  if (!tab) return null

  const svcHits = (gateText.match(SVC) || []).length

  // 関連性ゲート
  if (SVC_REQUIRED_TABS.has(tab) && svcHits < 1) return null
  if (!SVC_REQUIRED_TABS.has(tab) && !UNIVERSAL_TABS.has(tab)) return null

  // 定型スケルトンはサービス関連が薄ければ除外
  const formulaic = /^（?汎用的な/.test(r.prompt1)
  if (formulaic && svcHits < 1) return null

  let score = 0
  score += Math.min(svcHits, 5) * 2
  if (/Role:|Objective:|命令書|出力フォーマット|出力形式|# ?役割|## ?タスク/.test(r.prompt1)) score += 3
  if (formulaic) score -= 2
  if (/【[^】]+】|\[[^\]]+\]|\{\{/.test(r.prompt1)) score += 1
  if (r.prompt1.length < 80) score -= 2
  if (r.prompt1.length >= 150 && r.prompt1.length <= 2500) score += 1

  return { ...r, tab, score, svcHits }
}

const scored = rows.map(scoreRow).filter(Boolean)
// score>=3 を候補とし、各タブ上位15件にキャップ（合計~80を狙う）
const ranked = scored.filter(r => r.score >= 3).sort((a, b) => b.score - a.score)
const capCount = {}
const candidates = ranked.filter(r => {
  capCount[r.tab] = (capCount[r.tab] || 0) + 1
  return capCount[r.tab] <= 15
})

// タブごとに整理
const byTab = {}
for (const r of candidates) (byTab[r.tab] ??= []).push(r)

console.log(`\n=== キュレーション結果 ===`)
console.log(`元: ${rows.length}件 → 用途マッチ: ${scored.length}件 → 採用候補(score>=2): ${candidates.length}件\n`)
for (const t of TABS) {
  const list = (byTab[t.key] || [])
  console.log(`── ${t.key}（${list.length}件）──`)
  list.slice(0, 100).forEach(r => console.log(`  [${String(r.score).padStart(2)}] ${r.title}  〈${r.cate1Label}〉`))
  console.log()
}

// 出力
writeFileSync('prompts-curated.json', JSON.stringify(candidates, null, 2), 'utf8')

let md = `# キュレーション済みプロンプト（${candidates.length}件）\n\n対面サービス業向けに用途タブへ仕分け・スコアリング。score=関連度＋品質の合算。\n`
for (const t of TABS) {
  const list = byTab[t.key] || []
  md += `\n## ${t.key}（${list.length}件）\n\n`
  for (const r of list) {
    md += `### [${r.score}] ${r.title} 〈元: ${r.cate1Label}〉\n\n`
    if (r.explanation) md += `*${r.explanation}*\n\n`
    md += '```\n' + (r.prompt1.length > 600 ? r.prompt1.slice(0, 600) + '\n…' : r.prompt1) + '\n```\n\n'
    if (r.prompt2) md += '**prompt2:**\n```\n' + r.prompt2.slice(0, 300) + '\n```\n\n'
  }
}
writeFileSync('prompts-curated-review.md', md, 'utf8')
console.log('✅ 出力: prompts-curated.json / prompts-curated-review.md')

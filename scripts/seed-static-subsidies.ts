/**
 * scripts/seed-static-subsidies.ts
 *
 * 主要補助金を「静的データ」としてSupabaseに登録するスクリプト。
 * jGrantsのacceptance=1フィルターや募集間ギャップに影響されない。
 * source='static' なので jGrants/KDB sync が誤ってinactiveにしない。
 *
 * 実行: npx tsx scripts/seed-static-subsidies.ts
 */

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '../src/lib/llm'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── 主要補助金マスタ ────────────────────────────────────────
// 対面サービス業（飲食・理美容・小売）が使いやすい主要補助金
// 次回公募予定や最新情報はURLで確認するよう案内する

const STATIC_SUBSIDIES = [
  {
    external_id:  'static_jizokukahojokin',
    title:        '小規模事業者持続化補助金',
    catch_phrase: '小規模事業者の販路開拓・集客・店舗改装を支援する補助金。ホームページ制作・SNS広告・チラシ・内装リフォーム・インバウンド対応にも使える。',
    description:  `小規模事業者が経営計画を策定して販路開拓や業務効率化に取り組む際の費用を補助する。飲食店・美容室・理容室・小売店など対面サービス業に幅広く活用できる。店舗改装（内外装・バリアフリー化）・老朽化した内装の修理・更新・改修・内装リフォーム・設備の老朽化対応・厨房設備の更新・外壁塗装・看板製作・看板設置・外装工事・外観リニューアル・広告宣伝・ホームページ制作・新商品開発・設備購入など多様な経費が対象。老朽化した内装・設備・看板の新設・取り替え、外壁の塗り直し、店舗のリフォーム・改修工事にも使える。インバウンド対応（多言語メニュー作成・多言語看板・外国語対応チラシ・訪日外国人向け広告）にも活用可能。商工会議所・商工会が申請をサポートする。第19回(2026年4月30日締切済)。第20回は2026年秋頃公募予定。`,
    target:       `飲食業、美容・理容業（美容室・理容室・ヘアサロン・床屋）、小売業、宿泊業などのサービス業を含む小規模事業者（従業員5名以下、商業・サービス業の場合）。老朽化した店舗の内装・設備・外装を修理・更新したい事業者にも最適。インバウンド・訪日外国人対応を強化したい飲食店・小売店・宿泊業にも対応。集客・販路開拓をしたい事業者に最適。対象経費：ホームページ制作費・ウェブサイト制作費・SNS広告費・チラシ制作費・広告費・集客対策費・SEO対策費・販促物制作費・店舗改装費・内装工事費・設備更新費・外壁塗装費・看板製作費（多言語看板含む）・外装工事費・多言語メニュー制作費・機器購入費など幅広い経費。`,
    industry:     '共通_経営',
    prefecture:   null,
    max_amount:   2500000,
    subsidy_rate: '通常枠：補助率2/3、上限50万円。特例（インボイス・創業・事業承継等）：補助率3/4、上限200〜250万円。',
    deadline:     null,
    accepted_at:  null,
    url:          'https://s23.jizokukahojokin.info/',
  },
  {
    external_id:  'static_it_donyu',
    title:        'IT導入補助金（中小企業・小規模事業者等デジタル化推進事業）',
    catch_phrase: 'ITツール導入を支援。POSレジ・予約管理・会計ソフト・インバウンド対応・多言語システムにも使える',
    description:  `中小企業・小規模事業者がITツールを導入する際の費用を補助する。飲食店向けPOSレジ・モバイルオーダー・予約管理システム・会計ソフト・セキュリティ対策など業務効率化に役立つITツールが対象。インバウンド・訪日外国人対応として、多言語対応POSシステム・多言語予約システム・翻訳システム・多言語案内ツール・QRコード決済・クレジットカード端末・キャッシュレス決済システム・Wi-Fi整備なども対象となりうる。宿泊業（ホテル・旅館・民宿・ゲストハウス）のフロントシステム・宿泊管理システム・多言語チェックインシステムにも活用可能。複数の申請枠（通常枠・セキュリティ対策推進枠・インボイス枠等）がある。申請はIT導入支援事業者（ITベンダー）と共同で行う。2026年は第1次締切から順次受付中。`,
    target:       `飲食業、美容・理容業、小売業、宿泊業（ホテル・旅館・民宿・ゲストハウス）などの中小企業・小規模事業者。インバウンド対応・訪日外国人対応・多言語化を強化したい宿泊施設・飲食店・小売店にも最適。対象ツール：POSシステム、多言語対応POSレジ、多言語予約・宿泊管理システム、QRコード決済・キャッシュレス端末、会計・財務ソフト、受発注システム、多言語案内システム、EC構築、セキュリティ対策製品等。`,
    industry:     '共通_IT',
    prefecture:   null,
    max_amount:   4500000,
    subsidy_rate: '通常枠：補助率1/2、上限150万円〜450万円。インボイス枠：補助率3/4〜4/5、上限50万円。',
    deadline:     null,
    accepted_at:  null,
    url:          'https://it-hojo.jp/',
  },
  {
    external_id:  'static_monodukuri',
    title:        'ものづくり・商業・サービス生産性向上促進補助金（ものづくり補助金）',
    catch_phrase: '設備投資・システム構築・製品開発を支援する大型補助金',
    description:  `中小企業・小規模事業者が革新的な製品・サービス開発や設備投資を行う際の費用を補助する。飲食業では製麺機・スチームコンベクションオーブン・冷凍設備など大型厨房機器の導入に活用できる。理美容業では最新の施術機器、小売業では自動倉庫・物流システムなどに対応。年3〜4回公募。最新の公募回は中小企業庁サイトで確認。`,
    target:       `飲食業、美容・理容業、小売業などの中小企業・小規模事業者。対象経費：機械装置・システム構築費、外注費、専門家経費等。`,
    industry:     '共通_設備',
    prefecture:   null,
    max_amount:   25000000,
    subsidy_rate: '中小企業：補助率1/2、上限750万円〜1,250万円。小規模事業者：補助率2/3。省力化・グリーン枠等で上限引上げあり。',
    deadline:     null,
    accepted_at:  null,
    url:          'https://portal.monodukuri-hojo.jp/',
  },
  {
    external_id:  'static_shoryokuka',
    title:        '中小企業省力化投資補助金',
    catch_phrase: '人手不足解消に。配膳ロボット・自動精算機・券売機の導入に使える',
    description:  `中小企業・小規模事業者の人手不足解消のため、省力化に資するIoT・AI等を活用した汎用製品を導入する費用を補助する。飲食店への配膳ロボット・自動精算機・券売機、美容室への自動受付システム、小売店への無人レジ・棚卸しロボットなどが対象。カタログから製品を選んで申請するシステム。`,
    target:       `飲食業、美容・理容業、小売業などの中小企業・小規模事業者。対象製品：配膳ロボット・自動精算機・券売機・自動受付システム・清掃ロボット等のカタログ掲載製品。`,
    industry:     '共通_設備',
    prefecture:   null,
    max_amount:   10000000,
    subsidy_rate: '補助率1/2。上限：従業員5名以下200万円、6〜20名500万円、21名以上1,000万円。',
    deadline:     null,
    accepted_at:  null,
    url:          'https://shoryokuka.smrj.go.jp/',
  },
  {
    external_id:  'static_jigyou_saikouchi',
    title:        '事業再構築補助金',
    catch_phrase: '新分野展開・業態転換・事業転換を支援する大型補助金',
    description:  `コロナ禍や経済環境の変化に対応するため、新分野展開・業態転換・事業転換・事業再編等を行う中小企業を支援する。飲食店がテイクアウト・デリバリー特化型への転換、EC販売開始、異業種参入などに活用可能。第13回公募が継続中（交付申請等）。最新情報は事務局サイトで確認。`,
    target:       `飲食業、美容・理容業、小売業などの中小企業。新分野展開・業態転換を伴う設備投資・建物改修・システム構築等が対象経費。売上・利益計画の達成が条件。`,
    industry:     '共通_経営',
    prefecture:   null,
    max_amount:   150000000,
    subsidy_rate: '成長分野進出枠：補助率1/2（中小企業）〜2/3（小規模事業者）。グリーン成長枠等は別枠。',
    deadline:     null,
    accepted_at:  null,
    url:          'https://jigyou-saikouchiku.go.jp/',
  },
  {
    external_id:  'static_gyoumu_kaizen',
    title:        '業務改善助成金（厚生労働省）',
    catch_phrase: '賃上げと設備投資をセットで支援。飲食店の機器導入に使える',
    description:  `事業場内で最も低い賃金（事業場内最低賃金）を30円以上引き上げ、生産性向上に資する設備・機器を導入する際の費用を補助する助成金。飲食店での食器洗浄機・冷蔵庫・調理機器・POSシステム、美容室でのシャンプー台・スチーマー等の購入に活用可能。賃上げとセットが条件。通年申請可能（予算なくなり次第終了）。ハローワーク・労働局に申請。`,
    target:       `飲食業、美容・理容業、小売業などの中小企業・小規模事業者。賃金引上げ30円以上の実施が条件。対象経費：設備・機器購入費、システム構築費、外注費等。`,
    industry:     '共通_経営',
    prefecture:   null,
    max_amount:   6000000,
    subsidy_rate: '補助率：3/4〜9/10（引上げ額・コースにより異なる）。上限：30円コース30万円〜最大600万円（90円以上コース）。',
    deadline:     null,
    accepted_at:  null,
    url:          'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/02.html',
  },
]

// ─── メイン ──────────────────────────────────────────────────

async function main() {
  console.log(`▶ 静的補助金データ ${STATIC_SUBSIDIES.length}件 を登録中...\n`)

  for (const s of STATIC_SUBSIDIES) {
    const record = {
      ...s,
      is_active:      true,
      source:         'static',
      last_synced_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('subsidies')
      .upsert(record, { onConflict: 'external_id' })

    if (error) {
      console.error(`✗ upsert失敗 ${s.external_id}:`, error.message)
      continue
    }
    console.log(`✓ ${s.title}`)
  }

  // ── embedding 生成（静的データは常に再生成して最新に保つ）──────
  console.log('\n▶ 埋め込み生成開始（既存も上書き更新）')

  const { data: targets } = await supabase
    .from('subsidies')
    .select('id, external_id, title, catch_phrase, description, target, industry, prefecture, max_amount, subsidy_rate')
    .eq('source', 'static')
    .eq('is_active', true)

  const toEmbed = targets ?? []
  console.log(`  対象: ${toEmbed.length}件`)

  for (const t of toEmbed) {
    const text = [
      `補助金名: ${t.title}`,
      t.catch_phrase  && `概要: ${t.catch_phrase}`,
      t.description   && `内容: ${(t.description as string).slice(0, 1500)}`,
      t.target        && `対象: ${t.target}`,
      t.industry      && `業種: ${t.industry}`,
      t.max_amount    && `最大補助額: ${Number(t.max_amount).toLocaleString()}円`,
      t.subsidy_rate  && `補助率: ${t.subsidy_rate}`,
    ].filter(Boolean).join('\n')

    let vec: number[]
    try {
      vec = await generateEmbedding(text)
    } catch (e) {
      console.error(`  ✗ embedding失敗 ${t.external_id}:`, (e as Error).message)
      continue
    }

    const { error } = await supabase
      .from('subsidy_embeddings')
      .upsert(
        { subsidy_id: t.id, embedding: vec, embedded_text: text },
        { onConflict: 'subsidy_id' }
      )

    if (error) {
      console.error(`  ✗ embedding upsert失敗 ${t.external_id}:`, error.message)
    } else {
      console.log(`  ✓ ${t.title}`)
    }
  }

  console.log('\n✅ 静的補助金データ登録完了')
}

main().catch(err => {
  console.error('\n❌ 失敗:', err)
  process.exit(1)
})

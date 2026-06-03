# エンジニアA(フロントエンド担当)

## Claude Code実行用 仕様書兼指示書 v1.0

**プロジェクト**：対面サービス業向け統合AIプラットフォーム V0
**担当**：フロントエンド・UI実装
**開発期間**：30日(Day 1〜Day 30)
**主要技術**：Next.js 14 / React / TypeScript / Tailwind CSS / Supabase Auth (Client)

-----

## 0. このドキュメントの使い方

### 0.1 Claude Codeへの指示方法

このドキュメントの各タスクには、Claude Codeへの**指示プロンプト例**が記載されています。
基本的に以下の流れで作業します：

1. このドキュメントから今日のタスクを確認
1. Claude Codeに対応するプロンプトを投げる
1. 生成されたコードをレビュー・修正
1. 動作確認・コミット

### 0.2 エンジニアB(バック担当)との連携

- **DB・APIの設計はエンジニアBが主導**
- エンジニアAは**APIクライアント側**として実装
- 不明点は即Slackで質問(待たない)
- 共通の型定義(TypeScript types)は別途共有リポジトリで管理

### 0.3 Claude Code活用の鉄則

- **設計を確定してから実装を依頼**(設計から丸投げしない)
- **生成コードは必ずレビュー**(動けばOKではなく、保守性も確認)
- **小さく分割して依頼**(1ファイル単位が理想)
- **エラーは情報を増やして再依頼**(エラーメッセージ全文を渡す)

-----

## 1. プロジェクト初期設定(Day 1)

### 1.1 リポジトリ・環境構築

#### 作業手順

```bash
# 1. プロジェクト作成
npx create-next-app@latest aizoo-solo \
  --typescript --tailwind --app --src-dir --import-alias "@/*"

cd aizoo-solo

# 2. 必要なパッケージ追加
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react clsx
npm install -D @types/node

# 3. Vercel連携(GitHubリポジトリ作成後)
vercel link
vercel env pull .env.local
```

#### Claude Codeへの指示プロンプト例

```
Next.js 14のApp Router構成で、以下の要件のプロジェクト雛形を作成してください:

- TypeScript / Tailwind CSS使用
- ディレクトリ構成:
  src/
    app/                # ページとレイアウト
      (auth)/           # 認証関連ページ
        login/
        signup/
      (main)/           # 認証後のメインアプリ
        chat/
        templates/
        subsidies/
        training/
        settings/
    components/         # 共通コンポーネント
      ui/               # 汎用UI部品
      features/         # 機能別コンポーネント
    lib/                # ユーティリティ
      supabase/         # Supabaseクライアント
      api/              # APIクライアント関数
    types/              # 型定義
- 共通レイアウト(ヘッダー・サイドバー・フッター)を作成
- Tailwindのカラーパレットを以下で設定:
  primary: #1F4E79
  secondary: #2E75B6
  accent: #C5504B
```

### 1.2 環境変数設定

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=___(エンジニアBから受領)
NEXT_PUBLIC_SUPABASE_ANON_KEY=___(エンジニアBから受領)
NEXT_PUBLIC_API_BASE_URL=___(同上)
```

### 1.3 Day 1完了判定

- [ ] Next.jsプロジェクト雛形が動く
- [ ] Vercelに初回デプロイ完了
- [ ] 共通レイアウト(ヘッダー・フッター)が表示される
- [ ] エンジニアBからSupabase接続情報を受領済み

-----

## 2. デザインシステム(Day 2)

### 2.1 共通UI部品の作成

以下のUIコンポーネントを `src/components/ui/` 配下に作成。

#### 必要なコンポーネント

|コンポーネント名|用途                |
|--------|------------------|
|Button  |プライマリ/セカンダリ/アウトライン|
|Input   |テキスト入力            |
|Select  |プルダウン             |
|Textarea|複数行入力             |
|Card    |情報表示の枠            |
|Badge   |タグ・ステータス表示        |
|Modal   |モーダルダイアログ         |
|Toast   |通知表示              |
|Spinner |ローディング            |

#### Claude Codeへの指示プロンプト例

```
Next.js 14 + TypeScript + Tailwind CSSで、以下の汎用UIコンポーネントを作成してください。
各コンポーネントは src/components/ui/[名前].tsx として個別ファイルで。

1. Button.tsx
   - variant: "primary" | "secondary" | "outline" | "danger"
   - size: "sm" | "md" | "lg"
   - loading状態の表示
   - disabled対応

2. Input.tsx
   - label, error, helperTextをprops
   - エラー時のスタイル切替

3. Card.tsx
   - shadowとborderの選択可能
   - hoverエフェクトのオプション

それぞれforwardRefを使い、再利用しやすい設計にしてください。
カラーパレットはtailwind.config.tsの primary/secondary/accent を使用。
```

### 2.2 Day 2完了判定

- [ ] 9つの汎用UI部品が完成
- [ ] Storybook的に確認できるページ(/dev/components)を作成

-----

## 3. 認証フロー(Day 3〜4)

### 3.1 画面一覧

|画面ID   |パス              |機能                 |
|-------|----------------|-------------------|
|AUTH-01|/login          |メール・LINE・Googleログイン|
|AUTH-02|/signup         |新規登録               |
|AUTH-03|/forgot-password|パスワード再発行           |
|AUTH-04|/verify-email   |メール認証              |

### 3.2 ログイン画面(AUTH-01)の仕様

#### レイアウト

```
+-----------------------------------+
|       [サービスロゴ]              |
|                                   |
|       「おかえりなさい」          |
|                                   |
|  [メールアドレス入力欄]           |
|  [パスワード入力欄]               |
|  [ログインボタン(プライマリ)]     |
|                                   |
|  ----- または -----              |
|                                   |
|  [LINEでログイン(緑ボタン)]       |
|  [Googleでログイン(白ボタン)]     |
|                                   |
|  パスワードをお忘れの方はこちら  |
|  アカウントをお持ちでない方はこちら|
+-----------------------------------+
```

#### Claude Codeへの指示プロンプト例

```
Next.js 14 (App Router) + Supabase Authを使って、以下のログイン画面を作成してください。

ファイルパス: src/app/(auth)/login/page.tsx

要件:
1. メールアドレス＋パスワードでのログイン
   - signInWithPassword使用
   - エラー時はToast表示
   - 成功時は /home へリダイレクト

2. LINEログインボタン
   - signInWithOAuth({ provider: 'line' })
   - 緑色のLINEブランドカラー(#06C755)

3. Googleログインボタン
   - signInWithOAuth({ provider: 'google' })
   - 白背景・グレー枠

4. レスポンシブ対応(モバイルファースト)

5. Supabaseクライアントは src/lib/supabase/client.ts から import

UIコンポーネントは src/components/ui/ から再利用してください(Button, Input, Card)。
```

### 3.3 Day 4完了判定

- [ ] 4つの認証画面が動く
- [ ] メール認証でログイン成功
- [ ] LINE/Googleログイン(エンジニアBが設定済みの場合)
- [ ] 認証後 `/home` に遷移する

-----

## 4. 業種選択フロー(Day 5)

### 4.1 仕様

初回ログイン時のみ表示される設定フロー。

#### ステップ構成

|ステップ  |内容                              |
|------|--------------------------------|
|Step 1|大分類選択(理美容/飲食/小売/健康・治療/教育/医療/その他)|
|Step 2|中分類選択(例:美容室/理容室/ネイル等)           |
|Step 3|店舗規模(1名/2〜5名/6〜15名/16名以上)       |
|Step 4|店舗特徴入力(自由記述・任意)                 |

### 4.2 Claude Codeへの指示プロンプト例

```
Next.js 14のApp Routerで、4ステップの業種選択ウィザード画面を作成してください。

ファイルパス: src/app/(main)/onboarding/page.tsx

要件:
1. 4ステップのウィザード(プログレスバー付き)
   Step 1: 大分類(カード形式の選択肢7つ)
   Step 2: 中分類(Step 1の選択に応じて動的に表示)
   Step 3: 店舗規模(ラジオボタン4択)
   Step 4: 店舗特徴(textarea、最大200文字、任意)

2. 各ステップで「次へ」「戻る」ボタン
   - 必須項目未入力時は「次へ」を非活性

3. 完了時、APIへPOST送信
   - エンドポイント: POST /api/user/onboarding
   - body: { industry_l1, industry_l2, scale, features }

4. 業種マスタデータは src/lib/constants/industries.ts に定義
   const INDUSTRIES = {
     beauty: { label: '理美容', children: ['美容室', '理容室', 'ネイル', 'エステ', 'アイラッシュ'] },
     food: { label: '飲食', children: ['カフェ', 'レストラン', '居酒屋', 'ベーカリー'] },
     ...
   }

5. ステップ間でState管理(useStateまたはuseReducer)
6. UIはCardをカード選択肢として使用
```

### 4.3 Day 5完了判定

- [ ] 4ステップのウィザードが動く
- [ ] 業種マスタデータが整備されている
- [ ] 完了時にAPIへPOSTされる(モックでOK)

-----

## 5. チャットUI(Day 6〜10)

### 5.1 仕様

メインとなる対話画面。

#### レイアウト

```
+-----+----------------------------------+
|     |  [LLM選択] [現在の業種]         |
|サイド|                                  |
|バー  |  [メッセージ履歴エリア]         |
|     |  - ユーザー: メッセージ          |
|     |  - AI: ストリーミング表示       |
|     |                                  |
|     |  [テンプレ呼出][クイックアクセス]|
|     |  [テキスト入力欄][送信ボタン]   |
+-----+----------------------------------+
```

### 5.2 主要機能

- LLM選択プルダウン(ChatGPT/Claude/Gemini)
- メッセージ送信
- ストリーミング表示(SSE)
- マークダウン表示(react-markdown使用)
- コードブロックのシンタックスハイライト
- メッセージのコピー機能
- 会話のクリア機能

### 5.3 Day 6〜7：基本チャットUI

#### Claude Codeへの指示プロンプト例

```
Next.js 14のApp Routerで、ChatGPTライクなチャット画面を作成してください。

ファイルパス: src/app/(main)/chat/page.tsx
関連: src/components/features/chat/ 配下にコンポーネント分割

要件:
1. レイアウト
   - 左側: サイドバー(チャット履歴一覧、新規チャットボタン)
   - 右側: メイン(LLM選択、メッセージ表示、入力欄)

2. メッセージ表示
   - ユーザー(右寄せ、背景色: gray-100)
   - AI(左寄せ、背景色: white、アバター付き)
   - react-markdown でマークダウン表示
   - react-syntax-highlighter でコードハイライト

3. メッセージ送信
   - エンドポイント: POST /api/chat (SSEストリーミング)
   - body: { message, llm, history }
   - 受信中はAIアバターを点滅

4. LLM選択プルダウン
   - 選択肢: GPT-5.4 Mini / Claude Haiku 4.5 / Gemini 1.5 Flash
   - 選択値をlocalStorageに保存

5. スクロール挙動
   - 新メッセージ時に自動スクロール
   - 過去メッセージへの手動スクロール時は自動スクロール停止

依存追加: npm install react-markdown react-syntax-highlighter
```

### 5.4 Day 8〜10：高度な機能

- チャット履歴管理
- テンプレ呼び出し統合
- クイックアクセス(業種別)

#### Claude Codeへの指示プロンプト例

```
チャット画面に以下の機能を追加してください。

1. チャット履歴管理
   - サイドバーに過去のチャット一覧表示
   - APIから取得: GET /api/chats
   - チャットをクリックで /chat/[id] へ遷移

2. テンプレ呼出ボタン
   - 入力欄の上に「テンプレを使う」ボタン
   - クリックでモーダル表示(業種別テンプレ一覧)
   - 選択するとプロンプトが入力欄にセット

3. クイックアクセス(業種別)
   - 入力欄の下に、業種別の人気プロンプト3〜5個をボタン表示
   - APIから取得: GET /api/quick-prompts?industry=beauty

4. メッセージのコピーボタン(各AIメッセージにホバーで表示)

ファイル分割を維持し、コンポーネントを再利用可能な設計にしてください。
```

### 5.5 Day 10完了判定

- [ ] 3LLMでチャットが動く
- [ ] ストリーミング表示が動く
- [ ] マークダウン・コードブロックが正しく表示される
- [ ] チャット履歴がサイドバーに表示される

-----

## 6. テンプレート画面(Day 11〜12)

### 6.1 仕様

業種別テンプレートの選択・実行画面。

#### 画面構成

|画面  |パス                 |内容           |
|----|-------------------|-------------|
|一覧  |/templates         |業種別・カテゴリ別の一覧 |
|詳細  |/templates/[id]    |テンプレ詳細・入力フォーム|
|実行結果|/chat?template=[id]|チャット画面に遷移    |

### 6.2 Claude Codeへの指示プロンプト例

```
Next.js 14で、業種別テンプレートの一覧・詳細画面を作成してください。

ファイルパス:
- src/app/(main)/templates/page.tsx (一覧)
- src/app/(main)/templates/[id]/page.tsx (詳細)

要件:

【一覧画面】
1. ヘッダーに業種フィルタ(現在の業種が自動選択)
2. カテゴリタブ(クチコミ/SNS/メール/メニュー/経営)
3. テンプレカード一覧(グリッド表示)
   - 各カード: タイトル、説明、使用回数バッジ
4. 検索バー(タイトル・タグ検索)
5. APIから取得: GET /api/templates?industry=beauty&category=sns
6. お気に入りボタン(各カードにハートアイコン)

【詳細画面】
1. テンプレタイトル・説明表示
2. 入力フォーム(テンプレの variables に応じて動的生成)
   例: { name: "店名", placeholder: "例: ABCサロン", required: true }
3. 「このテンプレで対話を始める」ボタン
   → クリックでチャット画面に遷移、プロンプトが事前セット

3ステップフロー(選択→入力→生成)を視覚的に表現してください。
```

### 6.3 Day 12完了判定

- [ ] テンプレ一覧が業種別に表示される
- [ ] カテゴリ・検索でフィルタリングできる
- [ ] 詳細画面で入力→チャットへの遷移が動く

-----

## 7. 補助金検索画面(Day 13〜14)

### 7.1 仕様

既存補助金RAGをUIから利用する画面。

### 7.2 Claude Codeへの指示プロンプト例

```
Next.js 14で、補助金検索画面を作成してください。

ファイルパス: src/app/(main)/subsidies/page.tsx

要件:
1. 検索フォーム
   - 自由記述(自然言語検索): 例「美容室向けのDX補助金」
   - 都道府県・市区町村プルダウン
   - 業種(現在の業種が自動入力)

2. 検索ボタンクリック時
   - APIへPOST: POST /api/subsidies/search
   - body: { query, prefecture, city, industry }
   - レスポンスタイム3秒目標、ローディング表示

3. 結果表示
   - カード形式で補助金一覧
   - 各カード: タイトル、対象、金額上限、申請期限、対象URL
   - 「相談する」ボタン → 助成金コンシェルジュ(チャット)へ遷移

4. ページネーション(20件ずつ)

5. エラー処理
   - API失敗時: Toast表示 + 「お問い合わせ」誘導
   - 0件時: 空状態の表示
```

### 7.3 Day 14完了判定

- [ ] 補助金検索が動く
- [ ] 結果が3秒以内に表示される
- [ ] エラー時のフォールバックが動く

-----

## 8. 研修動画画面(Day 15)

### 8.1 仕様

LMS連携で研修動画を表示。

### 8.2 Claude Codeへの指示プロンプト例

```
Next.js 14で、研修動画一覧画面を作成してください。

ファイルパス: src/app/(main)/training/page.tsx

要件:
1. 業種別の動画一覧(現在の業種を自動選択)
2. カテゴリ別タブ(基礎/業種別/テンプレ活用)
3. 動画カード表示
   - サムネイル、タイトル、所要時間、視聴済バッジ
4. クリックでLMSへ遷移
   - 単純リンク方式(window.open新規タブ)
   - URLはAPIから取得: GET /api/training/videos?industry=beauty
5. 視聴履歴の表示(可能なら)
```

### 8.3 Day 15完了判定

- [ ] 動画一覧が表示される
- [ ] LMSへの遷移が動く

-----

## 9. 業種別コンシェルジュ画面(Day 16〜17)

### 9.1 仕様

業種別の専門AIアドバイザーとのチャット画面。

### 9.2 Claude Codeへの指示プロンプト例

```
Next.js 14で、業種別コンシェルジュ画面を作成してください。

ファイルパス:
- src/app/(main)/concierge/page.tsx (一覧)
- src/app/(main)/concierge/[id]/page.tsx (チャット)

要件:

【一覧画面】
1. 利用可能なコンシェルジュをカード表示
   - 業種別: 理美容コンシェルジュ/飲食コンシェルジュ/小売コンシェルジュ
   - 共通: 助成金コンシェルジュ
2. 各カード: アイコン、名前、得意分野
3. 「相談する」ボタン

【チャット画面】
1. 通常のチャット画面と類似UI
2. ヘッダーに選択中のコンシェルジュ情報
3. メッセージ送信時、APIへPOST
   - エンドポイント: POST /api/concierge/[id]/chat
   - コンシェルジュごとに専用システムプロンプトが付与される(バック側で処理)
4. 免責事項を画面下部に表示
   「※AIの回答は参考情報です。重要な判断は専門家にご相談ください」
```

### 9.3 Day 17完了判定

- [ ] 4つのコンシェルジュが選択できる
- [ ] 各コンシェルジュとチャットができる
- [ ] 免責事項が表示される

-----

## 10. LINE連携設定画面(Day 18)

### 10.1 仕様

LINE公式アカウント連携の設定画面(基本版)。

### 10.2 Claude Codeへの指示プロンプト例

```
Next.js 14で、LINE連携設定画面を作成してください。

ファイルパス: src/app/(main)/settings/line/page.tsx

要件:
1. LINE公式アカウント連携状況の表示
   - 未連携: 「連携する」ボタン
   - 連携済み: アカウント名表示+「解除」ボタン

2. 連携ボタンクリック
   - LINE Channel Access Token入力フォーム(モーダル)
   - APIへPOST: POST /api/line/connect
   
3. 連携後の機能案内
   - LINE経由での質問
   - LINE通知の設定
   - チェックボックスで通知ON/OFF
```

### 10.3 Day 18完了判定

- [ ] LINE連携設定画面が動く
- [ ] バック側API(/api/line/connect)と通信できる

-----

## 11. 簡易ダッシュボード(Day 19)

### 11.1 Claude Codeへの指示プロンプト例

```
Next.js 14で、ユーザーダッシュボード画面を作成してください。

ファイルパス: src/app/(main)/dashboard/page.tsx

要件:
1. 今月の利用状況サマリーカード
   - 利用回数(今月/先月比)
   - 使用LLM内訳(円グラフ)
   - よく使うテンプレTop3

2. 利用履歴グラフ(過去7日)
   - APIから取得: GET /api/dashboard/usage
   - recharts使用

3. おすすめアクション
   - 「使ったことがないテンプレ」
   - 「未視聴の研修動画」
   - 「該当する補助金」

依存追加: npm install recharts
```

### 11.2 Day 19完了判定

- [ ] ダッシュボードが表示される
- [ ] グラフが動く

-----

## 12. 課金画面(Day 22〜23)

### 12.1 仕様

Stripeを使ったサブスクリプション課金。

### 12.2 Claude Codeへの指示プロンプト例

```
Next.js 14で、課金プラン選択・管理画面を作成してください。

ファイルパス:
- src/app/(main)/plans/page.tsx (プラン選択)
- src/app/(main)/settings/billing/page.tsx (課金管理)

要件:

【プラン選択画面】
1. 3プランをカード表示
   - 無料(0円): 月50回・基礎研修のみ
   - ベーシック(2,980円): 標準機能・初月無料
   - プロ(9,800円): 上記+ライブ研修+コンシェルジュ全種

2. 各プランに「初月1ヶ月無料」バッジ(無料以外)

3. 「申し込む」ボタンクリック
   - Stripe Checkoutセッション作成API呼び出し
   - エンドポイント: POST /api/billing/checkout
   - body: { plan: 'basic' | 'pro' }
   - レスポンスのURLにリダイレクト

【課金管理画面】
1. 現在のプラン表示
2. 次回課金日・金額
3. 「プラン変更」ボタン
4. 「解約」ボタン(確認モーダル付き)
5. Stripe Customer Portalへのリンク
```

### 12.3 Day 23完了判定

- [ ] 3プランが選択できる
- [ ] Stripe Checkoutへ遷移する
- [ ] 課金成功後にプランがアップグレードされる

-----

## 13. ランディングページ(Day 25)

### 13.1 Claude Codeへの指示プロンプト例

```
Next.js 14で、サービスのランディングページを作成してください。

ファイルパス: src/app/page.tsx (ルートページ)

要件:
1. ヒーローセクション
   - キャッチコピー「対面サービス業の現場に、もう一人のスタッフを」
   - サブコピー・「無料で始める」CTAボタン

2. 機能紹介(3〜5項目)
   - 複数AI使い分け
   - 業種別テンプレ
   - 補助金検索
   - LINE連携
   - 研修動画

3. 料金プラン(プラン選択画面と同じ3プラン)

4. お客様の声(プレースホルダーでOK、後で差し替え)

5. よくある質問(FAQ、5〜10個)

6. CTA(再度)

7. フッター
   - サービス情報
   - 利用規約・プライバシーポリシーリンク
   - 特定商取引法表記リンク
   - お問い合わせ(コールセンター電話番号)

レスポンシブ対応必須。スマホファースト。
```

### 13.2 Day 25完了判定

- [ ] LPが完成
- [ ] スマホで表示崩れがない
- [ ] CTAから登録画面へ遷移する

-----

## 14. テスト・修正(Day 26〜28)

### 14.1 動作確認チェックリスト

```
□ 全画面のレスポンシブ確認(スマホ/タブレット/PC)
□ 全ブラウザでの動作確認(Chrome/Safari/Edge/Firefox)
□ ダークモード対応(オプション)
□ ローディング表示の統一
□ エラー処理の網羅
□ アクセシビリティ最低限(コントラスト・キーボード操作)
□ パフォーマンス(Lighthouse 70点以上)
```

-----

## 15. リリース対応(Day 29〜30)

### 15.1 リリース前最終確認

- 本番環境変数の確認
- 各種APIエンドポイントの本番URL確認
- 利用規約・プライバシーポリシーへの正しいリンク
- お問い合わせ先(コールセンター)の電話番号確認

-----

## 16. エンジニアBとの連携ポイント

### 16.1 必要なAPIエンドポイント一覧

エンジニアBが実装すべきAPIエンドポイントは別ドキュメント(エンジニアB向け仕様書)に記載。
ここでは、エンジニアAが呼び出す側として必要なものをリストアップ。

|エンドポイント                 |メソッド      |用途                    |
|------------------------|----------|----------------------|
|/api/auth/*             |Various   |認証(Supabase Authで対応)  |
|/api/user/onboarding    |POST      |業種選択完了                |
|/api/user/profile       |GET/PUT   |プロフィール取得・更新           |
|/api/chat               |POST      |LLM対話(SSE)            |
|/api/chats              |GET       |チャット履歴一覧              |
|/api/chats/[id]         |GET/DELETE|個別チャット                |
|/api/templates          |GET       |テンプレ一覧                |
|/api/templates/[id]     |GET       |テンプレ詳細                |
|/api/quick-prompts      |GET       |クイックアクセス              |
|/api/subsidies/search   |POST      |補助金検索                 |
|/api/training/videos    |GET       |研修動画一覧                |
|/api/concierge/[id]/chat|POST      |コンシェルジュ対話             |
|/api/line/connect       |POST      |LINE連携                |
|/api/dashboard/usage    |GET       |ダッシュボードデータ            |
|/api/billing/checkout   |POST      |Stripe Checkout       |
|/api/billing/portal     |POST      |Stripe Customer Portal|

### 16.2 共通の型定義

`src/types/api.ts` に以下の型を定義(エンジニアBと合意):

```typescript
export type Industry = 'beauty' | 'food' | 'retail' | 'health' | 'education' | 'medical' | 'other';
export type Plan = 'free' | 'basic' | 'pro' | 'enterprise';
export type LLMModel = 'gpt-mini' | 'claude-haiku' | 'gemini-flash';

export interface User {
  id: string;
  email: string;
  industry_l1: Industry;
  industry_l2: string;
  scale: '1' | '2-5' | '6-15' | '16+';
  features?: string;
  plan: Plan;
  created_at: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  industry: Industry;
  category: string;
  prompt: string;
  variables: Array<{ name: string; placeholder: string; required: boolean }>;
  usage_count: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// 他、必要に応じて追加
```

### 16.3 連携時の重要ルール

- **API仕様の変更は必ずSlackで通知**(双方向)
- **型定義は共有リポジトリで管理**(npm packageでもOK)
- **モックAPIを使った先行開発が可能**(エンジニアBが提供)
- **CORS設定はエンジニアB管轄**

-----

## 17. 開発進捗管理

### 17.1 日次タスク一覧(再掲)

|Day  |タスク       |完了判定             |
|-----|----------|-----------------|
|1    |プロジェクト初期設定|Vercelに初回デプロイ    |
|2    |デザインシステム  |9つのUI部品完成        |
|3-4  |認証フロー     |認証4画面が動く         |
|5    |業種選択フロー   |ウィザード動作          |
|6-10 |チャットUI    |3LLM対話・ストリーミング   |
|11-12|テンプレート画面  |一覧・詳細が動く         |
|13-14|補助金検索     |RAG連携で検索可能       |
|15   |研修動画画面    |LMS連携で表示         |
|16-17|コンシェルジュ   |4種のコンシェルジュ       |
|18   |LINE連携設定  |連携設定が動く          |
|19   |簡易ダッシュボード |グラフ表示            |
|20-21|バッファ・修正   |残課題対応            |
|22-23|課金画面      |Stripe Checkout動作|
|24   |セキュリティ・性能 |テスト合格            |
|25   |ランディングページ |LP完成             |
|26-28|テスト・修正    |動作確認完了           |
|29   |ソフトリリース   |本番デプロイ           |
|30   |β拡大       |50〜100社案内完了      |

### 17.2 日次スタンドアップ(17:00、5分)

各日終わりに以下をSlackで投稿:

```
■ 今日できたこと
- _______
- _______

■ 明日やること
- _______
- _______

■ ブロッカー(あれば)
- _______
```

-----

## 18. トラブルシューティング

### 18.1 よくある問題と対処

|問題             |対処                     |
|---------------|-----------------------|
|Vercelデプロイが失敗  |環境変数を確認、ビルドログを精読       |
|Supabase認証が動かない|エンジニアBにSupabase側設定を確認依頼|
|CORS エラー       |エンジニアBに連絡(バック側で対応)     |
|LLM応答が遅い       |エンジニアBに連絡(モデル変更で対応)    |
|型エラーが多発        |共有型定義を再import          |

### 18.2 緊急時の連絡先

- 経営者(あなた): __________________
- エンジニアB: __________________
- 関連会社: __________________

-----

**ドキュメント終了**

このドキュメントはClaude Codeへの指示プロンプト例を含んでいます。
実装時に状況に応じてカスタマイズしてください。
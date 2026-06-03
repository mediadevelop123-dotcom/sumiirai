# エンジニアB(バックエンド・データ・API担当)

## Claude Code実行用 仕様書兼指示書 v1.0

**プロジェクト**：対面サービス業向け統合AIプラットフォーム V0
**担当**：バックエンド・データベース・API・既存資産統合
**開発期間**：30日(Day 1〜Day 30)
**主要技術**：Supabase (PostgreSQL/Auth/Storage) / Next.js API Routes / LiteLLM / Stripe / 既存RAG/LMS API

-----

## 0. このドキュメントの使い方

### 0.1 Claude Codeへの指示方法

このドキュメントの各タスクには、Claude Codeへの**指示プロンプト例**が記載されています。

1. このドキュメントから今日のタスクを確認
1. Claude Codeに対応するプロンプトを投げる
1. 生成されたコードをレビュー・修正(セキュリティ要注意)
1. 動作確認・コミット

### 0.2 エンジニアA(フロント担当)との連携

- **DB・APIの設計はあなたが主導**
- **APIエンドポイントの仕様を最初に確定**(エンジニアAが先行開発できる)
- **モックAPIを早期提供**(エンジニアAの開発を止めない)
- **共通の型定義(TypeScript types)は別途共有リポジトリで管理**

### 0.3 Claude Code活用の鉄則

- **設計を確定してから実装を依頼**(設計から丸投げしない)
- **生成コードは必ずレビュー**(セキュリティを最優先で確認)
- **小さく分割して依頼**(1機能単位が理想)
- **エラーは情報を増やして再依頼**(エラーメッセージ全文を渡す)

### 0.4 セキュリティの絶対ルール

- **APIキーは絶対にクライアント側に出さない**
- **Supabase Row Level Security(RLS)は必ず有効化**
- **LLM API呼び出しはサーバーサイドのみ**
- **Stripe Webhookの署名検証は必須**
- **環境変数の管理はVercelで完結させる**

-----

## 1. プロジェクト初期設定(Day 1)

### 1.1 Supabaseプロジェクト作成

#### 作業手順

```bash
# 1. Supabase Cloudで新規プロジェクト作成
# URL: https://supabase.com
# プロジェクト名: aizoo-solo-prod
# リージョン: ap-northeast-1 (Tokyo)
# DB password: 強固なものを生成・保管

# 2. 接続情報を取得
# - Project URL: https://xxx.supabase.co
# - Anon key: eyJ...
# - Service role key: eyJ...

# 3. ローカル環境変数(.env.local)に設定
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # サーバーサイド専用、絶対にクライアントに出さない
```

### 1.2 Vercel設定

```bash
# Vercelで新規プロジェクト作成
# 環境変数を設定
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
# - GOOGLE_GEMINI_API_KEY
# - STRIPE_SECRET_KEY
# - STRIPE_WEBHOOK_SECRET
# - SUBSIDY_RAG_API_URL
# - SUBSIDY_RAG_API_KEY
# - LMS_API_URL
# - LMS_API_KEY
# - LINE_CHANNEL_SECRET
# - LINE_CHANNEL_ACCESS_TOKEN
```

### 1.3 既存資産担当者との接続テスト

#### 必須タスク(Day 1中に完了)

- [ ] 補助金RAG APIへ接続テスト(curl)
- [ ] LMS APIへ接続テスト
- [ ] プロンプトサイトのデータエクスポート依頼

#### 接続テストのスクリプト例

```bash
# 補助金RAG APIテスト
curl -X POST https://[補助金RAG_URL]/search \
  -H "Authorization: Bearer [APIキー]" \
  -H "Content-Type: application/json" \
  -d '{"query": "美容室向けDX補助金", "prefecture": "東京都"}'

# レスポンスを確認、構造を文書化
```

### 1.4 Day 1完了判定

- [ ] Supabaseプロジェクト作成完了
- [ ] エンジニアAへ接続情報共有
- [ ] 既存資産との接続テスト完了
- [ ] Vercel環境変数設定完了

-----

## 2. データベース設計(Day 2)

### 2.1 テーブル設計(全体像)

```
■ ユーザー関連
- users (ユーザー基本情報、業種等)
- user_profiles (詳細プロフィール)

■ コンテンツ関連
- chats (チャットセッション)
- messages (個別メッセージ)
- templates (業種別テンプレート)
- favorites (お気に入り)

■ 既存資産連携
- training_videos (LMS動画メタデータ)
- subsidy_searches (補助金検索履歴)

■ コンシェルジュ
- concierges (コンシェルジュマスタ)
- concierge_chats (コンシェルジュ別チャット)

■ 連携
- line_connections (LINE公式アカウント連携)

■ 課金・利用ログ
- subscriptions (Stripeサブスクリプション)
- usage_logs (利用ログ)
- llm_costs (LLM API原価管理)
```

### 2.2 SQLマイグレーションファイル作成

#### Claude Codeへの指示プロンプト例

```
Supabase(PostgreSQL)用のマイグレーションSQLを作成してください。
ファイルパス: supabase/migrations/20260520000001_initial_schema.sql

要件:
1. 以下のテーブルを作成
   - users (id UUID PK, email TEXT UNIQUE, industry_l1 TEXT, industry_l2 TEXT, scale TEXT, features TEXT, plan TEXT DEFAULT 'free', stripe_customer_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())
   - chats (id UUID PK, user_id UUID FK→users, title TEXT, created_at, updated_at)
   - messages (id UUID PK, chat_id UUID FK→chats, role TEXT CHECK IN ('user','assistant','system'), content TEXT, llm_model TEXT, tokens_used INTEGER, created_at)
   - templates (id UUID PK, title TEXT, description TEXT, industry TEXT, category TEXT, prompt TEXT, variables JSONB, usage_count INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at)
   - favorites (id UUID PK, user_id UUID FK→users, template_id UUID FK→templates, UNIQUE(user_id, template_id))
   - concierges (id UUID PK, name TEXT, category TEXT, industry TEXT, system_prompt TEXT, description TEXT, is_active BOOLEAN DEFAULT true)
   - line_connections (user_id UUID PK FK→users, line_channel_id TEXT, access_token_encrypted TEXT, connected_at)
   - subscriptions (id UUID PK, user_id UUID FK→users, stripe_subscription_id TEXT, plan TEXT, status TEXT, current_period_end TIMESTAMPTZ, trial_end TIMESTAMPTZ)
   - usage_logs (id UUID PK, user_id UUID FK→users, action TEXT, llm_model TEXT, tokens INTEGER, cost_jpy NUMERIC(10,4), created_at)

2. 全テーブルにRow Level Security(RLS)を有効化
3. 各テーブルにRLSポリシー設定:
   - users: 本人のみ参照・更新可能
   - chats/messages/favorites: 本人のみアクセス可能
   - templates/concierges: 全認証ユーザー参照可能
   - subscriptions/usage_logs: 本人のみ参照可能

4. updated_atの自動更新トリガー
5. 必要なインデックス
   - users(email)
   - chats(user_id, created_at DESC)
   - messages(chat_id, created_at ASC)
   - templates(industry, category)
   - usage_logs(user_id, created_at DESC)

すべての制約・トリガー・インデックスを含めてください。
```

### 2.3 Supabase Authの設定

#### 設定項目

- メール認証を有効化
- LINEプロバイダー設定(LINE Developers Consoleで作成したChannel ID/Secretを設定)
- Googleプロバイダー設定(Google Cloud Consoleで作成)
- メール認証時のリダイレクトURL設定: `https://[your-domain]/auth/callback`

#### Claude Codeへの指示プロンプト例

```
Supabase認証用のNext.jsクライアントとサーバーサイドユーティリティを作成してください。

ファイル:
1. src/lib/supabase/client.ts (クライアントサイド用)
2. src/lib/supabase/server.ts (サーバーサイド用、Cookieベース)
3. src/lib/supabase/middleware.ts (Next.js middleware用)
4. src/middleware.ts (認証ガード)

要件:
- @supabase/ssr パッケージ使用
- 認証必須ページは /chat, /templates, /subsidies, /training, /concierge, /dashboard, /settings/*, /plans
- 認証ページ(/login, /signup)へは未認証時のみアクセス可
- 認証チェック失敗時は /login へリダイレクト

参考: https://supabase.com/docs/guides/auth/server-side/nextjs
```

### 2.4 Day 2完了判定

- [ ] 全テーブル作成完了
- [ ] RLS有効化完了
- [ ] Supabase Authの基本設定完了
- [ ] エンジニアAへスキーマ共有

-----

## 3. 認証API実装(Day 3〜4)

### 3.1 認証フロー設計

主にSupabase Authに任せるが、追加処理が必要なエンドポイントを実装。

#### 必要なエンドポイント

|エンドポイント             |メソッド   |用途                 |
|--------------------|-------|-------------------|
|/auth/callback      |GET    |OAuth/メール認証後のコールバック|
|/api/user/onboarding|POST   |業種選択完了処理           |
|/api/user/profile   |GET/PUT|プロフィール取得・更新        |

### 3.2 Claude Codeへの指示プロンプト例

```
Next.js 14 App Routerのバックエンド(API Routes)を作成してください。

ファイル:
1. src/app/auth/callback/route.ts
   - Supabase OAuth/メール認証のコールバック
   - codeをセッションに交換
   - 初回ログイン時は /onboarding へ、それ以外は /home へリダイレクト

2. src/app/api/user/onboarding/route.ts
   - POST: 業種選択を保存
   - body: { industry_l1, industry_l2, scale, features }
   - usersテーブルを更新
   - 認証チェック必須

3. src/app/api/user/profile/route.ts
   - GET: ログインユーザーのプロフィール返却
   - PUT: プロフィール更新

要件:
- すべて認証必須(未認証は401)
- バリデーション必須(zod使用推奨)
- Supabase Service Role Keyは使わず、ユーザーセッションのSupabaseクライアントを使用
- エラーハンドリングを丁寧に

依存追加: npm install zod
```

### 3.3 Day 4完了判定

- [ ] 認証コールバックが動く
- [ ] オンボーディング保存が動く
- [ ] プロフィールAPI動作確認

-----

## 4. LLM対話API実装(Day 5〜7)

### 4.1 設計方針

- **LiteLLM**を使って3LLM(OpenAI/Anthropic/Gemini)を統一インターフェースで扱う
- ストリーミングはSSE(Server-Sent Events)で実装
- ユーザーの業種情報をシステムプロンプトに自動付加
- 利用ログ・原価をDBに記録

### 4.2 LiteLLM導入

```bash
# Node.jsバージョンを使用
npm install litellm
```

または、Pythonバージョンを別サービスとして立てる選択肢もあり(後者がより安定)。
**V0ではNode.js直接実装で簡略化**することを推奨。

### 4.3 Claude Codeへの指示プロンプト例

```
Next.js 14 App RouterでLLMチャットAPIを作成してください。
SSEストリーミング対応必須。

ファイル: src/app/api/chat/route.ts

要件:
1. POST /api/chat
   - 認証必須
   - body: { message: string, llm: 'gpt-mini' | 'claude-haiku' | 'gemini-flash', chat_id?: string, history?: Message[] }

2. システムプロンプトの自動構築
   - ユーザーのusersテーブルから業種情報取得
   - 以下のシステムプロンプトを先頭に挿入:
     """
     あなたは対面サービス業向けのAIアシスタントです。
     ユーザーの業種: {industry_l2}({industry_l1})
     店舗規模: {scale}
     店舗の特徴: {features}
     
     業種特性を理解した上で、具体的かつ実践的な回答をしてください。
     """

3. LLMルーティング
   - gpt-mini → OpenAI gpt-5.4-mini
   - claude-haiku → Anthropic claude-haiku-4.5
   - gemini-flash → Google gemini-1.5-flash

4. ストリーミング応答(SSE)
   - レスポンスは text/event-stream
   - 各チャンクをdata: {...}形式で送信

5. 完了時の処理
   - chats / messages テーブルに保存
   - usage_logs にトークン数・原価を記録
   - 原価計算:
     - gpt-mini: $0.15 / 1M input, $0.60 / 1M output
     - claude-haiku: $0.25 / 1M input, $1.25 / 1M output
     - gemini-flash: $0.075 / 1M input, $0.30 / 1M output
     - 為替: 1USD=150JPYで換算(環境変数化推奨)

6. レート制限
   - 無料プラン: 月50回(usage_logsから集計)
   - ベーシック: 月50万トークン
   - プロ: 月200万トークン
   - 超過時はエラーレスポンス(403)

7. エラーハンドリング
   - LLM API失敗時: 別LLMへフォールバック
   - すべての失敗をログ記録

各社のAPI呼び出しは個別関数として実装してください:
- callOpenAI(messages, stream)
- callAnthropic(messages, stream)
- callGemini(messages, stream)
```

### 4.4 チャット履歴API

#### Claude Codeへの指示プロンプト例

```
チャット履歴管理用のAPIを作成してください。

ファイル:
1. src/app/api/chats/route.ts
   - GET: ログインユーザーのチャット一覧(最新50件)
   - 認証必須

2. src/app/api/chats/[id]/route.ts
   - GET: チャット詳細とメッセージ一覧
   - DELETE: チャット削除(関連メッセージも削除)
   - 本人のチャットのみアクセス可能(RLSで強制)

3. src/app/api/chats/[id]/messages/route.ts
   - GET: 特定チャットの全メッセージ取得

すべて認証必須、RLSでセキュリティ確保。
```

### 4.5 Day 7完了判定

- [ ] 3LLMで対話できる
- [ ] ストリーミング応答が動く
- [ ] 履歴がDBに保存される
- [ ] 利用ログが記録される

-----

## 5. テンプレート管理API(Day 8〜9)

### 5.1 既存プロンプトサイトからのデータ移行

#### 作業手順

```
1. 既存プロンプトサイト管轄者からCSV/JSON形式でデータ受領
2. 業種別タグ付け(7業種)
3. カテゴリ分類(クチコミ/SNS/メール/メニュー/経営)
4. variables(動的な入力項目)の定義
5. SupabaseのtemplatesテーブルへINSERT
```

#### Claude Codeへの指示プロンプト例

```
既存のプロンプトデータをSupabaseに投入するためのスクリプトを作成してください。

ファイル: scripts/seed-templates.ts

入力データ形式(CSVを想定):
title, description, original_prompt, suggested_industry, suggested_category

要件:
1. CSVを読み込む
2. 各行を以下に変換:
   - id: UUID自動生成
   - title: そのまま
   - description: そのまま
   - industry: suggested_industryを正規化
   - category: suggested_categoryを正規化
   - prompt: original_prompt(中の{店名}などの変数を {{name_店名}} 形式に変換)
   - variables: promptから変数を抽出してJSONB化
     例: [{ name: "name_店名", placeholder: "例: ABCサロン", required: true }]
3. Supabase Service Role Keyを使ってバルクINSERT
4. 重複チェック(title+industry)

実行方法: npx tsx scripts/seed-templates.ts ./data/prompts.csv

依存追加: npm install csv-parse @supabase/supabase-js -D tsx
```

### 5.2 テンプレートAPI実装

#### Claude Codeへの指示プロンプト例

```
テンプレート管理用APIを作成してください。

ファイル:
1. src/app/api/templates/route.ts
   - GET: テンプレート一覧
   - query params: industry, category, search, page, limit
   - 認証必須、is_active=trueのみ返却

2. src/app/api/templates/[id]/route.ts
   - GET: テンプレ詳細

3. src/app/api/templates/[id]/use/route.ts
   - POST: 使用カウントを+1(usage_count)

4. src/app/api/favorites/route.ts
   - GET: 自分のお気に入り一覧
   - POST: お気に入り追加 body: { template_id }
   - DELETE: お気に入り削除

5. src/app/api/quick-prompts/route.ts
   - GET: 業種別の人気プロンプトTop5
   - query: industry
   - templates.usage_countでソート

すべて認証必須。RLSでセキュリティ確保。
```

### 5.3 Day 9完了判定

- [ ] テンプレデータ140種が投入済み
- [ ] テンプレAPIが動く
- [ ] お気に入り機能が動く

-----

## 6. 補助金RAG連携API(Day 10〜11)

### 6.1 既存補助金RAGとの接続設計

#### 接続パターン

```
Frontend
  → POST /api/subsidies/search (本サービスのAPI)
  → 既存補助金RAG API呼び出し
  → 結果整形してフロントへ返却
```

### 6.2 Claude Codeへの指示プロンプト例

```
補助金検索APIを作成してください。

ファイル: src/app/api/subsidies/search/route.ts

要件:
1. POST /api/subsidies/search
   - 認証必須
   - body: { query: string, prefecture?: string, city?: string, industry?: string }

2. 既存補助金RAG API呼び出し
   - URL: process.env.SUBSIDY_RAG_API_URL
   - Authorization: Bearer process.env.SUBSIDY_RAG_API_KEY
   - リクエスト形式は既存API仕様に従う(別途確認)

3. レスポンス整形
   - 既存APIのレスポンスをフロントエンド向けに整形
   - 形式:
     {
       results: [
         {
           id: string,
           title: string,
           description: string,
           target: string, // 対象事業者
           max_amount: number, // 最大金額(円)
           deadline: string, // 申請期限
           url: string, // 詳細URL
           tags: string[]
         }
       ],
       total: number,
       page: number
     }

4. キャッシュ戦略
   - 同一クエリは5分間キャッシュ(Vercel KV or in-memory)
   - キャッシュキー: ハッシュ(query + prefecture + city + industry)

5. エラー処理
   - RAG API失敗時: 503 Service Unavailable
   - タイムアウト: 10秒で打ち切り
   - 0件時: 空配列を返却

6. 検索履歴の保存(オプション)
   - 後で「よく検索される補助金」分析用

依存追加なし(標準fetchで対応)
```

### 6.3 Day 11完了判定

- [ ] 補助金検索APIが動く
- [ ] レスポンス3秒以内
- [ ] キャッシュが効いている
- [ ] エラーハンドリング完備

-----

## 7. LMS連携API(Day 12)

### 7.1 LMS連携の選択

|選択肢     |実装難易度  |UX  |
|--------|-------|----|
|A. リンク方式|簡単(1日) |UX分断|
|B. SSO連携|中(3〜5日)|統合体験|

**V0推奨**: 案A(リンク方式)。V1で案Bへ移行。

### 7.2 Claude Codeへの指示プロンプト例

```
LMS連携用のAPIを作成してください。

ファイル: src/app/api/training/videos/route.ts

要件:
1. GET /api/training/videos
   - query: industry, category
   - 既存LMS APIから動画一覧を取得
   - レスポンス形式:
     {
       videos: [
         {
           id: string,
           title: string,
           description: string,
           thumbnail_url: string,
           duration_minutes: number,
           lms_url: string, // LMSへの直接リンク
           industry: string,
           category: string
         }
       ]
     }

2. LMS API呼び出し
   - URL: process.env.LMS_API_URL
   - Authorization: Bearer process.env.LMS_API_KEY
   - LMS固有のAPI仕様に従う(別途確認)

3. キャッシュ: 1時間(動画一覧は頻繁に変わらない)

4. エラー時のフォールバック
   - LMS API失敗時: ハードコードした「メンテナンス中」ページへ誘導
```

### 7.3 Day 12完了判定

- [ ] LMS動画一覧APIが動く
- [ ] エンジニアAから接続可能

-----

## 8. コンシェルジュAPI(Day 13〜14)

### 8.1 コンシェルジュデータ投入

#### Claude Codeへの指示プロンプト例

```
コンシェルジュマスタデータを作成するSQLを書いてください。

ファイル: supabase/seeds/concierges.sql

データ:
1. 理美容コンシェルジュ
   - name: '理美容コンシェルジュ'
   - category: 'industry'
   - industry: 'beauty'
   - system_prompt: '''
     あなたは理美容業界(美容室・理容室・ネイル・エステ等)のサロン経営に詳しい専門アドバイザーです。
     サロン経営、薬機法、予約管理、リピーター戦略、スタッフ管理、SNS集客など、
     サロンの日々の経営課題に対して、業界の実情を理解した実践的なアドバイスを提供してください。
     
     重要: 法律・税務・労務に関する具体的な判断は専門家への相談を推奨してください。
     '''

2. 飲食コンシェルジュ
   - name: '飲食コンシェルジュ'
   - industry: 'food'
   - system_prompt: 飲食店経営、HACCP、メニュー戦略、衛生管理に詳しい

3. 小売コンシェルジュ
   - industry: 'retail'
   - system_prompt: 店舗運営、在庫管理、陳列、インバウンド対応に詳しい

4. 助成金コンシェルジュ
   - category: 'common'
   - industry: NULL (全業種)
   - system_prompt: '''
     あなたは中小企業・個人事業主向けの助成金・補助金の専門アドバイザーです。
     ユーザーの業種・所在地・規模に基づいて、活用可能な助成金を提案してください。
     
     回答の最後には必ず:
     「最新の制度内容・申請可否は社労士による無料相談をご利用ください」
     と案内してください。
     '''

全て is_active = true で投入。
```

### 8.2 コンシェルジュチャットAPI

#### Claude Codeへの指示プロンプト例

```
コンシェルジュ専用チャットAPIを作成してください。

ファイル: src/app/api/concierge/[id]/chat/route.ts

要件:
1. POST /api/concierge/[id]/chat
   - 認証必須
   - body: { message: string, history?: Message[] }
   - path: id はコンシェルジュID

2. コンシェルジュ情報取得
   - conciergesテーブルから system_prompt 取得
   - 業種制限がある場合(industry IS NOT NULL)、ユーザーの業種と一致確認
   - 不一致時: 403 Forbidden

3. システムプロンプト構築
   - コンシェルジュのsystem_prompt
   + ユーザーの業種・規模情報
   + 免責事項

4. LLM呼び出し(/api/chatと同様の仕組み)
   - 助成金コンシェルジュの場合、補助金RAGを呼び出してコンテキストに追加(オプション)
   - その他のコンシェルジュは通常のLLM対話

5. ストリーミング応答(SSE)

6. ログ記録
   - usage_logs にコンシェルジュ利用として記録(action: 'concierge_chat')
```

### 8.3 Day 14完了判定

- [ ] コンシェルジュデータ投入完了
- [ ] 4種のコンシェルジュとチャットできる
- [ ] 免責事項が応答に含まれる

-----

## 9. LINE連携API(Day 15〜17)

### 9.1 設計

V0では以下の最小機能のみ実装:

- LINEログイン(Supabase Auth経由で対応)
- LINE公式アカウント連携設定
- LINE Botからの質問→AI回答(オプション)

### 9.2 LINE公式アカウント連携

#### Claude Codeへの指示プロンプト例

```
LINE公式アカウント連携用のAPIを作成してください。

ファイル:
1. src/app/api/line/connect/route.ts
   - POST: チャネルアクセストークン保存
   - body: { channel_access_token, channel_secret }
   - トークンを暗号化してline_connectionsテーブルへ保存
   - 暗号化キー: process.env.LINE_TOKEN_ENCRYPTION_KEY

2. src/app/api/line/disconnect/route.ts
   - POST: 連携解除
   - line_connectionsレコード削除

3. src/app/api/line/webhook/route.ts
   - POST: LINE Messaging APIからのWebhook受信
   - 署名検証必須(X-Line-Signatureヘッダ)
   - イベント処理:
     - message.text: AIに質問送信、回答をLINEに返信
     - その他のイベント: ログのみ
   - ユーザー特定: LINE user_idからusersテーブルを検索
     (将来的にline_user_idカラム追加が必要)

要件:
- 暗号化にはNode.js crypto モジュール使用
- LINE SDKを使うとシンプル(npm install @line/bot-sdk)
- セキュリティ最優先(署名検証は絶対)
```

### 9.3 Day 17完了判定

- [ ] LINE連携設定が動く
- [ ] LINE Botから質問→AI回答が動く(オプション)

-----

## 10. ダッシュボードAPI(Day 18)

### 10.1 Claude Codeへの指示プロンプト例

```
ユーザーダッシュボード用のAPIを作成してください。

ファイル: src/app/api/dashboard/usage/route.ts

要件:
1. GET /api/dashboard/usage
   - 認証必須
   - レスポンス:
     {
       this_month: {
         total_count: number,
         total_tokens: number,
         total_cost_jpy: number
       },
       last_month: {
         total_count: number,
         total_tokens: number,
         total_cost_jpy: number
       },
       llm_breakdown: [
         { llm_model: string, count: number, percentage: number }
       ],
       daily_usage_last_7_days: [
         { date: string, count: number }
       ],
       top_templates: [
         { id: string, title: string, usage_count: number }
       ],
       recommended_actions: [
         { type: string, title: string, description: string, link: string }
       ]
     }

2. usage_logsテーブルから集計
3. 過去7日のデータは日別に集計
4. recommended_actionsは以下のロジック:
   - 「未視聴の研修動画」: training_videos APIから取得して未視聴を抽出
   - 「使ったことがないテンプレ」: templates - favorites
   - 「該当する補助金」: 直近30日に補助金検索していなければ案内
```

### 10.2 Day 18完了判定

- [ ] ダッシュボードAPIが動く
- [ ] エンジニアAから確認可能

-----

## 11. 課金システム(Day 19〜23)

### 11.1 Stripeセットアップ

#### 作業手順

```
1. Stripeアカウント作成(本番モード)
2. 商品(Product)作成:
   - ベーシック: 月額2,980円
   - プロ: 月額9,800円
3. 価格(Price)作成
4. Webhook設定
   - エンドポイント: https://[domain]/api/billing/webhook
   - イベント: customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed
5. APIキー・Webhook secretを環境変数に
```

### 11.2 Stripe連携API

#### Claude Codeへの指示プロンプト例

```
Stripe決済用のAPIを作成してください。

ファイル:
1. src/app/api/billing/checkout/route.ts
   - POST: Stripe Checkoutセッション作成
   - body: { plan: 'basic' | 'pro' }
   - 初月無料: trial_period_days=30
   - 成功時URL: /billing/success
   - キャンセル時URL: /plans
   - レスポンス: { url: string } (Stripeのリダイレクト先)

2. src/app/api/billing/portal/route.ts
   - POST: Stripe Customer Portalセッション作成
   - 顧客が自分でプラン変更・解約できる画面へ誘導

3. src/app/api/billing/webhook/route.ts
   - POST: StripeからのWebhook受信
   - 署名検証必須(Stripe-Signature)
   - イベント処理:
     - customer.subscription.created: subscriptionsテーブルに新規作成、users.planを更新
     - customer.subscription.updated: 同上、ステータス更新
     - customer.subscription.deleted: status=cancelledに、users.planをfreeに
     - invoice.paid: 利用継続
     - invoice.payment_failed: ステータス更新、ユーザーへ通知メール送信

要件:
- Stripe SDK使用: npm install stripe
- Webhook secretは process.env.STRIPE_WEBHOOK_SECRET
- 全エンドポイントで認証必須(webhookのみ署名検証で代替)
- エラーログ記録
```

### 11.3 Day 23完了判定

- [ ] Stripe Checkoutが動く
- [ ] 初月無料が適用される
- [ ] Webhookで自動課金が動く
- [ ] 解約・再開が動く

-----

## 12. レート制限・原価管理(Day 24)

### 12.1 Claude Codeへの指示プロンプト例

```
レート制限と原価管理のミドルウェアを作成してください。

ファイル: src/lib/rate-limit.ts

要件:
1. checkRateLimit(userId: string): Promise<{ allowed: boolean, reason?: string }>
   - usersテーブルからplanを取得
   - usage_logsから今月の利用量を集計
   - プラン別上限と比較
     - free: 月50回
     - basic: 月50万トークン
     - pro: 月200万トークン
     - enterprise: 無制限

2. /api/chat と /api/concierge/[id]/chat の冒頭でこの関数を呼ぶ
3. 上限超過時は429 Too Many Requestsを返す

4. 原価アラート機能(オプション)
   - 1ID/月の原価が以下を超えた場合、Slackへ通知
     - free: 200円
     - basic: 800円
     - pro: 2,000円
   - 自動的に軽量モデルへ強制切替(将来実装)
```

### 12.2 Day 24完了判定

- [ ] レート制限が動く
- [ ] 上限超過時に正しくエラー
- [ ] 原価集計が正確

-----

## 13. 既存助成金AI運用との連携(Day 25)

### 13.1 設計

既存の助成金AI運用を新サービスから利用するための連携。

#### Claude Codeへの指示プロンプト例

```
既存の助成金AI運用との連携APIを作成してください。

ファイル: src/app/api/subsidies/consultation/route.ts

要件:
1. POST /api/subsidies/consultation
   - 認証必須
   - body: { subsidy_id?: string, user_question: string }
   - ユーザー情報(業種・地域・規模)を自動付加

2. 既存助成金AIシステムへリクエスト
   - エンドポイント: process.env.EXISTING_SUBSIDY_AI_URL
   - 既存システムの仕様に従う(別途確認)

3. 回答を整形してフロントへ返却
4. 必要に応じて社労士事務所への問い合わせフォーム表示
```

### 13.2 Day 25完了判定

- [ ] 既存助成金AI連携が動く

-----

## 14. セキュリティ・性能最終調整(Day 26)

### 14.1 セキュリティチェックリスト

```
□ 全API認証チェックの確認
□ SQL Injection対策(Supabaseクライアント使用で自動対策)
□ XSS対策(Reactで基本対策、ただしdangerouslySetInnerHTMLは禁止)
□ CSRF対策(Same-Site Cookie、API Routes)
□ レート制限(全API)
□ APIキーの環境変数管理(.envをコミットしない確認)
□ HTTPS強制(Vercel自動対応)
□ RLS有効化確認(全テーブル)
□ Webhook署名検証(Stripe, LINE)
□ パスワードハッシュ(Supabase Authで自動対応)
□ セッショントークンの安全管理
```

### 14.2 性能チェック

```
□ チャット初動応答: 2秒以内
□ 補助金検索: 3秒以内
□ ダッシュボード読み込み: 2秒以内
□ DBクエリの最適化(EXPLAIN ANALYZE)
□ 必要なインデックスがすべて作成済み
□ N+1問題のチェック
□ キャッシュ戦略の確認
```

### 14.3 Day 26完了判定

- [ ] セキュリティチェック完了
- [ ] 性能要件達成

-----

## 15. テスト・運用準備(Day 27〜28)

### 15.1 主要テストケース

```
□ 新規登録 → メール認証 → オンボーディング → ログイン
□ LINE/Googleログイン
□ 各LLMでのチャット
□ ストリーミング応答
□ テンプレ選択 → 入力 → チャット
□ 補助金検索 → 結果表示
□ 研修動画一覧 → LMS遷移
□ コンシェルジュ4種との対話
□ LINE連携設定
□ ダッシュボード表示
□ 課金 → プランアップグレード
□ 解約 → プランダウングレード
□ レート制限超過時の挙動
```

### 15.2 監視・アラート設定

#### Claude Codeへの指示プロンプト例

```
監視・ログ収集の基盤を整えてください。

要件:
1. Sentry導入
   - エラートラッキング
   - npm install @sentry/nextjs

2. Vercel Analytics導入(Webパフォーマンス監視)

3. Slack通知
   - 重大エラー時に開発チャンネルへ通知
   - 1日の原価が閾値超過時に通知
   - Webhook URLは環境変数化
```

-----

## 16. リリース対応(Day 29〜30)

### 16.1 リリース前最終チェック

```
□ 本番環境変数の確認(Vercelダッシュボード)
□ Supabase本番設定確認
□ Stripe本番モードへ切替
□ ドメイン・SSL証明書確認
□ DBバックアップ設定
□ Sentryアラート設定
□ ステータスページ準備
```

### 16.2 リリース後の継続運用

```
日次:
- エラーログ確認(Sentry)
- 原価モニタリング(usage_logs集計)

週次:
- パフォーマンス分析
- ユーザーフィードバック整理
- 課題優先順位の見直し
```

-----

## 17. エンジニアAとの連携ポイント

### 17.1 提供すべきAPIエンドポイント一覧(再掲)

|エンドポイント                 |メソッド           |完成日(目標)|
|------------------------|---------------|-------|
|/api/user/onboarding    |POST           |Day 4  |
|/api/user/profile       |GET/PUT        |Day 4  |
|/api/chat               |POST(SSE)      |Day 7  |
|/api/chats              |GET            |Day 7  |
|/api/chats/[id]         |GET/DELETE     |Day 7  |
|/api/templates          |GET            |Day 9  |
|/api/templates/[id]     |GET            |Day 9  |
|/api/quick-prompts      |GET            |Day 9  |
|/api/favorites          |GET/POST/DELETE|Day 9  |
|/api/subsidies/search   |POST           |Day 11 |
|/api/training/videos    |GET            |Day 12 |
|/api/concierge/[id]/chat|POST(SSE)      |Day 14 |
|/api/line/connect       |POST           |Day 17 |
|/api/dashboard/usage    |GET            |Day 18 |
|/api/billing/checkout   |POST           |Day 23 |
|/api/billing/portal     |POST           |Day 23 |

### 17.2 モックAPI先行提供

エンジニアAが先行開発できるよう、各APIのモック実装を優先的に提供:

#### Claude Codeへの指示プロンプト例

```
エンジニアAが先行開発できるよう、各APIエンドポイントのモック実装を作成してください。

ファイル: src/app/api/_mocks/* または各エンドポイントの最初のバージョン

要件:
- 実装前の段階で、ハードコードされたダミーデータを返すモックAPIを用意
- 環境変数 MOCK_API=true の時のみモックモード
- 本番実装が完了したら自動的にモックを使わない
- エンジニアAが利用するすべてのエンドポイントを網羅
```

### 17.3 共通の型定義(再掲)

`src/types/api.ts` をエンジニアAと共有:

```typescript
// エンジニアA向け仕様書と同じ内容を共有
```

### 17.4 連携時の重要ルール

- **API仕様の変更は必ずSlackで通知**(双方向)
- **モックAPIを早期提供**(エンジニアAの開発を止めない)
- **CORS設定はNext.js App Routerでは基本不要**(同一オリジン)
- **エンジニアAが詰まったら30分以内に応答**

-----

## 18. 開発進捗管理

### 18.1 日次タスク一覧(再掲)

|Day  |タスク                       |完了判定        |
|-----|--------------------------|------------|
|1    |Supabase・Vercel・既存API接続テスト|エンジニアAへ環境提供 |
|2    |DB設計・マイグレーション・Auth設定      |スキーマ完成      |
|3-4  |認証API・オンボーディング            |エンジニアAから利用可能|
|5-7  |LLM対話API(3LLM, SSE, 履歴保存) |ストリーミング動作   |
|8-9  |テンプレートAPI・データ移行(140種)     |テンプレ140種利用可能|
|10-11|補助金RAG連携                  |検索3秒以内      |
|12   |LMS連携                     |動画一覧取得可能    |
|13-14|コンシェルジュAPI(4種)            |全種対話可能      |
|15-17|LINE連携(Webhook含む)         |連携動作        |
|18   |ダッシュボードAPI                |集計動作        |
|19-23|Stripe課金システム              |初月無料→課金フロー動作|
|24   |レート制限・原価管理                |制御動作        |
|25   |既存助成金AI連携                 |動作確認        |
|26   |セキュリティ・性能調整               |チェックリスト合格   |
|27-28|テスト・運用準備                  |全機能テスト合格    |
|29   |ソフトリリース                   |本番環境動作      |
|30   |β拡大対応                     |50〜100社案内完了 |

### 18.2 日次スタンドアップ(17:00、5分)

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

## 19. トラブルシューティング

### 19.1 よくある問題と対処

|問題                 |対処                       |
|-------------------|-------------------------|
|Supabase接続エラー      |URL/Anon Keyの確認、CORS設定   |
|LLM API失敗          |APIキー確認、レート制限確認、リトライ実装   |
|Stripe Webhookが届かない|エンドポイントURL、署名確認          |
|既存RAG API遅い        |タイムアウト設定、キャッシュ強化         |
|RLSで403エラー         |ポリシー再確認、user_idのマッチ確認    |
|LINE Webhook検証失敗   |Channel Secret、署名計算ロジック確認|

### 19.2 緊急時の連絡先

- 経営者: __________________
- エンジニアA: __________________
- 既存資産担当: __________________
- 関連会社: __________________

-----

## 20. 環境変数一覧(完全版)

### 20.1 本番環境(Vercelに設定)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# LLM
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GEMINI_API_KEY=AI...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PRO=price_...

# 既存資産API
SUBSIDY_RAG_API_URL=https://...
SUBSIDY_RAG_API_KEY=...
LMS_API_URL=https://...
LMS_API_KEY=...
EXISTING_SUBSIDY_AI_URL=https://...

# LINE
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_TOKEN_ENCRYPTION_KEY=... # 32バイトのランダム文字列

# 監視
SENTRY_DSN=https://...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# その他
USD_TO_JPY_RATE=150 # 原価計算用
```

-----

**ドキュメント終了**

このドキュメントはClaude Codeへの指示プロンプト例を含んでいます。
実装時に状況に応じてカスタマイズしてください。
セキュリティに関わる部分は必ず手動レビューを実施してください。
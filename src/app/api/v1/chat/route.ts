/**
 * app/api/v1/chat/route.ts
 *
 * POST /api/v1/chat
 *
 * リクエスト Body:
 *   {
 *     messages:   { role: 'user' | 'assistant', content: string }[]  // 会話履歴(最新のユーザーメッセージを末尾に含む)
 *     prefecture?: string  // 例: "大阪府"(省略時は全国)
 *   }
 *
 * SSE レスポンス (text/event-stream):
 *   event: sources  — 検索された補助金リスト (JSON配列)
 *   event: delta    — LLM 応答テキスト断片 { text: string }
 *   event: done     — 完了 {}
 *   event: error    — エラー { message: string }
 */

import { generateEmbedding, chatStream, getChatModelId } from '@/lib/llm'
import type { LLMMessage } from '@/lib/llm'
import { getServiceClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase-server'
import { createSession, getSession, addMessage, ensureSessionTitle } from '@/lib/chat-store'

// ─── 型定義 ──────────────────────────────────────────────────

interface SubsidyResult {
  id: string
  title: string
  description?: string | null
  catch_phrase?: string | null
  target?: string | null
  industry?: string | null
  prefecture?: string | null
  max_amount?: number | null
  subsidy_rate?: string | null
  difficulty?: string | null
  deadline?: string | null
  url: string
  source?: string | null
  similarity: number
}

// ─── 補助金情報をプロンプト用テキストに整形 ──────────────────

function formatSubsidy(s: SubsidyResult, index: number): string {
  return [
    `【補助金${index + 1}】${s.title}`,
    s.catch_phrase && `  概要: ${s.catch_phrase}`,
    s.description  && `  内容: ${s.description.slice(0, 300)}`,
    s.target       && `  対象: ${s.target}`,
    s.max_amount   && `  最大補助額: ${s.max_amount.toLocaleString()}円`,
    s.subsidy_rate && `  補助率・支援規模: ${s.subsidy_rate}`,
    s.prefecture   && `  対象地域: ${s.prefecture}`,
    s.deadline     && `  申請締切: ${new Date(s.deadline).toLocaleDateString('ja-JP')}`,
    `  詳細URL: ${s.url}`,
  ].filter(Boolean).join('\n')
}

// ─── 会話履歴の末尾トリム (トークン超過対策) ─────────────────

const MAX_HISTORY_TURNS = 6  // user + assistant のペア数上限

function trimHistory(
  messages: { role: 'user' | 'assistant'; content: string }[]
): LLMMessage[] {
  // system メッセージは含まれない前提
  if (messages.length <= MAX_HISTORY_TURNS * 2) {
    return messages as LLMMessage[]
  }
  return messages.slice(-(MAX_HISTORY_TURNS * 2)) as LLMMessage[]
}

// ─── Route Handler ────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 認証チェック ──────────────────────────────────────────
  const user = await getUser()
  if (!user) {
    return Response.json(
      { error: 'AUTH_001: ログインが必要です' },
      { status: 401 }
    )
  }

  const body = await req.json()
  const {
    messages = [],
    prefecture,
    sessionId: incomingSessionId,
  } = body as {
    messages:    { role: 'user' | 'assistant'; content: string }[]
    prefecture?: string
    sessionId?:  string
  }

  // 最後のユーザーメッセージを取得 (RAG 検索クエリに使用)
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMsg?.content?.trim()) {
    return Response.json(
      { error: 'VAL_001: メッセージを入力してください' },
      { status: 400 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // fail-safe: クライアント切断時に enqueue が例外を出しても続行する
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // client disconnected — ignore and keep processing
        }
      }

      try {
        // ── Step 0: セッション解決 & ユーザーメッセージ保存 ───────
        //   既存 sessionId があれば所有者確認、無ければ新規作成。
        //   永続化は best-effort: 失敗してもチャット自体は継続する。
        let sessionId: string | null = null
        try {
          if (incomingSessionId) {
            const existing = await getSession(incomingSessionId, user.id)
            sessionId = existing?.id ?? null
          }
          if (!sessionId) {
            const created = await createSession({
              userId:     user.id,
              prefecture: prefecture ?? null,
            })
            sessionId = created.id
          }
          await addMessage({
            sessionId,
            role:    'user',
            content: lastUserMsg.content,
          })
          // クライアントが以降の会話で同じセッションを継続できるよう通知
          send('session', { sessionId })
        } catch (e) {
          console.error('[chat] セッション/ユーザーメッセージ保存失敗:', e)
          sessionId = null
        }

        // ── Step 1: 最新ユーザーメッセージをベクトル化 ────────────
        const embedding = await generateEmbedding(lastUserMsg.content)

        // ── Step 2: pgvector で類似補助金を検索 ──────────────────
        const supabase = getServiceClient()
        const { data: subsidies, error: dbError } = await supabase.rpc(
          'search_subsidies',
          {
            query_embedding:   embedding,
            filter_prefecture: prefecture ?? null,
            match_count:       5,
          }
        )

        if (dbError) throw new Error(`DB_001: 検索失敗 — ${dbError.message}`)

        const subsidyList = (subsidies ?? []) as SubsidyResult[]

        // ── Step 3: 補助金リストをクライアントへ先送信 ────────────
        send('sources', subsidyList)

        // ── Step 4: LLM プロンプト構築 ───────────────────────────
        const contextBlock = subsidyList.length > 0
          ? `【検索された補助金情報 (${prefecture ?? '全国'})】\n` +
            subsidyList.map(formatSubsidy).join('\n\n')
          : `【補助金情報】\n現在の条件に合致する補助金が見つかりませんでした。` +
            `条件を変えてお試しいただくか、一般的なご相談として回答します。`

        const systemPrompt = `あなたは中小企業・個人事業主向けの補助金専門アドバイザーです。
主に飲食業・理美容業・小売業などの対面サービス業を支援します。

【回答ルール】
- 提供された補助金情報の中から最も適切なものを選んで具体的に説明する
- 補助金名・金額・申請締切・URLを必ず記載する
- 提供された情報にない内容は推測で答えない（ハルシネーション防止）
- 複数の補助金が該当する場合は、最も適合度の高いものを中心に説明する
- 会話の流れを踏まえ、自然な対話形式で回答する
- 最後に「詳細は各URLで必ずご確認ください」と付け加える
- 必ず「β版のため参考情報としてご活用ください」と注記する
- 補助金以外の経営相談も受け付けるが、関連する補助金があれば積極的に紹介する

${contextBlock}`

        const llmMessages: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          ...trimHistory(messages),
        ]

        // ── Step 5: LLM ストリーミング応答 ───────────────────────
        const { stream: llmStream, usage: usagePromise } = await chatStream(llmMessages)
        const reader = llmStream.getReader()
        const dec = new TextDecoder()
        let assistantText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const piece = dec.decode(value, { stream: true })
          assistantText += piece
          send('delta', { text: piece })
        }

        // ストリーム終了後にトークン使用量を取得
        const { inputTokens, outputTokens } = await usagePromise

        // ── Step 6: アシスタント応答を保存 (best-effort) ──────────
        if (sessionId && assistantText.trim()) {
          try {
            await addMessage({
              sessionId,
              role:         'assistant',
              content:      assistantText,
              llmModelId:   getChatModelId(),
              inputTokens,
              outputTokens,
              sources:      subsidyList,
            })
            // セッションにタイトルが無ければ最初のユーザー質問から自動生成
            // (多ターン会話では messages[0] が最初の質問)
            const firstUserContent = messages.find(m => m.role === 'user')?.content
              ?? lastUserMsg.content
            await ensureSessionTitle(sessionId, user.id, firstUserContent)
          } catch (e) {
            console.error('[chat] アシスタントメッセージ保存失敗:', e)
          }
        }

        send('done', { sessionId })

      } catch (err) {
        send('error', { message: (err as Error).message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection:      'keep-alive',
    },
  })
}

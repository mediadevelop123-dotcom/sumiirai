/**
 * app/api/v1/subsidies/rag/route.ts
 *
 * POST /api/v1/subsidies/rag
 * Body: { question: string, prefecture?: string }
 *
 * レスポンス: SSE ストリーム (text/event-stream)
 * - 最初に "sources" イベントで検索された補助金リストを送信
 * - 続いて "delta" イベントで LLM 応答テキストをストリーミング
 * - 最後に "done" イベントで終了
 */

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding, chatStream } from '@/lib/llm'
import type { LLMMessage } from '@/lib/llm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 補助金情報をプロンプト用テキストに整形
function formatSubsidy(s: SubsidyResult, index: number): string {
  return [
    `【補助金${index + 1}】${s.title}`,
    s.catch_phrase && `  概要: ${s.catch_phrase}`,
    s.description  && `  内容: ${s.description?.slice(0, 300)}`,
    s.target       && `  対象: ${s.target}`,
    s.max_amount   && `  最大補助額: ${s.max_amount.toLocaleString()}円`,
    s.subsidy_rate && `  補助率: ${s.subsidy_rate}`,
    s.prefecture   && `  対象地域: ${s.prefecture}`,
    s.deadline     && `  締切: ${new Date(s.deadline).toLocaleDateString('ja-JP')}`,
    `  詳細URL: ${s.url}`,
  ].filter(Boolean).join('\n')
}

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
  deadline?: string | null
  url: string
  similarity: number
}

export async function POST(req: Request) {
  const { question, prefecture } = await req.json()

  if (!question?.trim()) {
    return Response.json({ error: 'VAL_001: 質問を入力してください' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // ── Step 1: 質問をベクトル化 ─────────────────────────────
        const embedding = await generateEmbedding(question)

        // ── Step 2: pgvector で類似補助金を検索 ──────────────────
        const { data: subsidies, error } = await supabase.rpc('search_subsidies', {
          query_embedding: embedding,
          filter_prefecture: prefecture ?? null,
          match_count: 5,
        })

        if (error) throw new Error(`DB_001: 検索失敗 ${error.message}`)
        if (!subsidies?.length) {
          send('error', { message: '該当する補助金が見つかりませんでした。条件を変えてお試しください。' })
          controller.close()
          return
        }

        // ── Step 3: 検索結果を先にクライアントへ送信 ─────────────
        send('sources', subsidies)

        // ── Step 4: LLM へ渡すプロンプトを構築 ───────────────────
        const context = (subsidies as SubsidyResult[])
          .map((s, i) => formatSubsidy(s, i))
          .join('\n\n')

        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: `あなたは中小企業向け補助金アドバイザーです。
以下の補助金情報をもとに、ユーザーの質問に対して最適な補助金を日本語で丁寧に説明してください。

【回答ルール】
- 提供された補助金情報の中から最も適切なものを選んで説明する
- 補助金名・最大補助額・締切・URLを必ず記載する
- 提供された情報にない内容は答えない(ハルシネーション防止)
- 最後に「詳細は各URLでご確認ください」と付け加える
- β版のため「参考情報としてご活用ください」と必ず注記する

【検索された補助金情報】
${context}`,
          },
          {
            role: 'user',
            content: question,
          },
        ]

        // ── Step 5: LLM ストリーミング応答 ───────────────────────
        const { stream: llmStream } = await chatStream(messages)
        const reader = llmStream.getReader()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          send('delta', { text: new TextDecoder().decode(value) })
        }

        send('done', {})
      } catch (err) {
        send('error', { message: (err as Error).message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

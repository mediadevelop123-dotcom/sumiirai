/**
 * lib/llm.ts  — LLM / Embeddings 抽象レイヤー
 *
 * LLM_PROVIDER=openai  → OpenAI GPT-4o-mini + text-embedding-3-small (dim: 1536)
 * LLM_PROVIDER=bedrock → Amazon Bedrock Claude Haiku 4.5 + Titan Embeddings V2 (dim: 1024)
 *
 * ─── Bedrock 利用開始手順 ────────────────────────────────────
 * 1. npm install @aws-sdk/client-bedrock-runtime
 * 2. .env.local に追加:
 *    LLM_PROVIDER=bedrock
 *    AWS_REGION=us-east-1
 *    AWS_ACCESS_KEY_ID=<your-access-key>
 *    AWS_SECRET_ACCESS_KEY=<your-secret-key>
 * 3. Bedrock Model catalog で以下を有効化:
 *    - Amazon Titan Embeddings V2       (amazon.titan-embed-text-v2:0)
 *    - Anthropic Claude Haiku / Sonnet / Opus  (Bedrock cross-region inference profiles)
 * 4. Supabase SQL Editor で 003_bedrock_migration.sql を実行
 * 5. 埋め込みを再生成: npx tsx scripts/sync-subsidies.ts
 * ────────────────────────────────────────────────────────────
 */

import OpenAI from 'openai'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from './llm-models'

// ─── 型定義 ──────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TokenUsage {
  inputTokens:  number | null
  outputTokens: number | null
}

export interface LLMStreamResult {
  stream: ReadableStream<Uint8Array>
  /** ストリーム完了後にトークン使用量を返す Promise */
  usage:  Promise<TokenUsage>
}

// ─── プロバイダー情報 ─────────────────────────────────────────

export function getProvider(): 'openai' | 'bedrock' {
  const p = process.env.LLM_PROVIDER ?? 'openai'
  if (p !== 'openai' && p !== 'bedrock') {
    throw new Error(`未対応の LLM_PROVIDER: "${p}". "openai" か "bedrock" を設定してください`)
  }
  return p
}

/**
 * 埋め込みベクトルの次元数
 * ※ Supabase の subsidy_embeddings.embedding と必ず一致させること
 *   OpenAI  text-embedding-3-small → 1536
 *   Bedrock Titan Embeddings V2    → 1024
 */
export function getEmbeddingDimension(): number {
  return getProvider() === 'bedrock' ? 1024 : 1536
}

/**
 * チャットモデルの llm_models.id を返す。
 * modelId が指定されていればそれを使用、未指定なら LLM_PROVIDER から解決。
 */
export function getChatModelId(modelId?: string): string {
  if (modelId) return modelId
  return DEFAULT_MODEL_ID
}

/**
 * modelId からプロバイダを解決する。
 * 未指定なら LLM_PROVIDER 環境変数にフォールバック。
 */
function resolveProvider(modelId?: string): 'openai' | 'bedrock' {
  if (!modelId) return getProvider()
  const entry = AVAILABLE_MODELS.find(m => m.id === modelId)
  return entry?.provider ?? getProvider()
}

/**
 * 現在のプロバイダに対応する llm_models.id (埋め込みモデル)。
 */
export function getEmbeddingModelId(): string {
  return getProvider() === 'bedrock'
    ? 'bedrock-titan-embed-v2'
    : 'openai-text-embedding-3-small'
}

// ─── クライアント初期化 ───────────────────────────────────────

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY が設定されていません')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function getBedrockClient() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY が設定されていません')
  }
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
}

// ─── Embeddings ───────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = getProvider()

  // ── OpenAI: text-embedding-3-small (1536次元) ─────────────────
  if (provider === 'openai') {
    const client = getOpenAIClient()
    const { data } = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return data[0].embedding
  }

  // ── Bedrock: Titan Embeddings V2 (1024次元) ───────────────────
  const client = getBedrockClient()
  const res = await client.send(new InvokeModelCommand({
    modelId:     'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept:      'application/json',
    body: JSON.stringify({
      inputText:  text,
      dimensions: 1024,
      normalize:  true,
    }),
  }))
  const json = JSON.parse(new TextDecoder().decode(res.body))
  return json.embedding
}

// ─── Bedrock モデル ID 解決 ───────────────────────────────────

// Bedrock cross-region inference profile IDs (us-east-1 routing)
// IDs can be verified in: AWS Console → Bedrock → Model catalog → Inference profiles
function getBedrockModelId(modelId?: string): string {
  switch (modelId) {
    case 'bedrock-claude-sonnet-4-6': return 'us.anthropic.claude-sonnet-4-6'
    case 'bedrock-claude-opus-4-8':   return 'us.anthropic.claude-opus-4-8'
    default:                          return 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
  }
}

// ─── チャット (ストリーミング) ────────────────────────────────

export async function chatStream(
  messages: LLMMessage[],
  modelId?: string,
): Promise<LLMStreamResult> {
  const provider = resolveProvider(modelId)
  const encoder = new TextEncoder()

  // ── OpenAI: GPT-4o-mini ───────────────────────────────────────
  if (provider === 'openai') {
    const client = getOpenAIClient()
    const openaiStream = await client.chat.completions.create({
      model:          'gpt-4o-mini',
      messages,
      stream:         true,
      stream_options: { include_usage: true },
      temperature:    0.3,
      max_tokens:     1500,
    })

    let usageResolve!: (v: TokenUsage) => void
    const usage = new Promise<TokenUsage>(res => { usageResolve = res })

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let inputTokens: number | null = null
        let outputTokens: number | null = null
        try {
          for await (const chunk of openaiStream) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) controller.enqueue(encoder.encode(delta))
            // 最終チャンクに usage が含まれる
            if (chunk.usage) {
              inputTokens  = chunk.usage.prompt_tokens
              outputTokens = chunk.usage.completion_tokens
            }
          }
        } finally {
          controller.close()
          usageResolve({ inputTokens, outputTokens })
        }
      },
    })
    return { stream, usage }
  }

  // ── Bedrock: Claude Haiku / Sonnet / Opus ────────────────────
  const client = getBedrockClient()

  // Bedrock Anthropic API は system を別フィールドで受け取る
  const systemContent = messages.find(m => m.role === 'system')?.content
  const chatMessages  = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }))

  const res = await client.send(new InvokeModelWithResponseStreamCommand({
    modelId:     getBedrockModelId(modelId),
    contentType: 'application/json',
    accept:      'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens:        1500,
      temperature:       0.3,
      ...(systemContent ? { system: systemContent } : {}),
      messages: chatMessages,
    }),
  }))

  let usageResolve!: (v: TokenUsage) => void
  const usage = new Promise<TokenUsage>(res => { usageResolve = res })

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let inputTokens: number | null = null
      let outputTokens: number | null = null
      try {
        for await (const event of res.body!) {
          if (!event.chunk?.bytes) continue
          const json = JSON.parse(new TextDecoder().decode(event.chunk.bytes))

          // content_block_delta: テキスト断片
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            controller.enqueue(encoder.encode(json.delta.text))
          }
          // message_start: input_tokens が含まれる
          if (json.type === 'message_start' && json.message?.usage) {
            inputTokens = json.message.usage.input_tokens ?? null
          }
          // message_delta: output_tokens が含まれる
          if (json.type === 'message_delta' && json.usage) {
            outputTokens = json.usage.output_tokens ?? null
          }
        }
      } catch (e) {
        controller.error(e)
      } finally {
        controller.close()
        usageResolve({ inputTokens, outputTokens })
      }
    },
  })
  return { stream, usage }
}

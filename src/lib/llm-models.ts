/**
 * lib/llm-models.ts — クライアント・サーバー共有のモデル定義
 *
 * llm.ts は AWS SDK をインポートするためクライアント不可。
 * モデル一覧はここで定義し、チャット UI から import する。
 */

export const AVAILABLE_MODELS = [
  { id: 'bedrock-claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'bedrock' as const },
  { id: 'openai-gpt-4o-mini',       name: 'GPT-4o mini',      provider: 'openai'  as const },
] as const

export type ModelId = typeof AVAILABLE_MODELS[number]['id']

export const DEFAULT_MODEL_ID: ModelId = 'bedrock-claude-haiku-4-5'

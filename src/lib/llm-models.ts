/**
 * lib/llm-models.ts — クライアント・サーバー共有のモデル定義
 *
 * llm.ts は AWS SDK をインポートするためクライアント不可。
 * モデル一覧はここで定義し、チャット UI から import する。
 */

export const AVAILABLE_MODELS = [
  { id: 'bedrock-claude-haiku-4-5',  name: 'Claude Haiku',  provider: 'bedrock' as const },
  { id: 'bedrock-claude-sonnet-4-6', name: 'Claude Sonnet', provider: 'bedrock' as const },
  { id: 'bedrock-claude-opus-4-8',   name: 'Claude Opus',   provider: 'bedrock' as const },
] as const

export type ModelId = typeof AVAILABLE_MODELS[number]['id']

export const DEFAULT_MODEL_ID: ModelId = 'bedrock-claude-haiku-4-5'

/**
 * scripts/update-llm-model.ts — llm_models を Claude 3.5 Haiku に更新
 * npx tsx --env-file=.env.local scripts/update-llm-model.ts
 */
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL 未設定'); process.exit(1) }

async function main() {
  const url = new URL(DATABASE_URL!.trim())
  const client = new Client({
    host: url.hostname.trim(), port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username).trim(),
    password: decodeURIComponent(url.password).trim(),
    database: (url.pathname.replace('/', '') || 'postgres').trim(),
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  // Claude Haiku 4.5 を追加
  await client.query(`
    INSERT INTO llm_models (
      id, provider, family, version, display_name, model_type,
      is_active, input_price_per_1m_usd, output_price_per_1m_usd,
      context_window, max_output_tokens, api_endpoint, api_model_id,
      capabilities
    ) VALUES (
      'bedrock-claude-haiku-4-5',
      'anthropic', 'claude-haiku', '4.5',
      'Claude Haiku 4.5 (Bedrock)',
      'chat', true,
      0.80, 4.00,
      200000, 64000,
      'bedrock',
      'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      '{"vision": false}'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      api_model_id = EXCLUDED.api_model_id,
      display_name = EXCLUDED.display_name,
      is_active    = true,
      updated_at   = NOW()
  `)
  console.log('✅ bedrock-claude-haiku-4-5 を追加/更新しました')

  // 旧モデルを非アクティブ化
  await client.query(`
    UPDATE llm_models SET is_active = false
    WHERE id IN ('bedrock-claude-3-haiku', 'bedrock-claude-3-5-haiku')
  `)
  console.log('⚠ 旧 Claude 3/3.5 Haiku を非アクティブ化しました')

  await client.end()
}

main()

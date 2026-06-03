/**
 * app/api/v1/subsidies/search/route.ts に配置するファイルのサンプル
 *
 * POST /api/v1/subsidies/search
 * Body: { query: string, prefecture?: string, limit?: number }
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // サーバーサイド専用
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  const { query, prefecture, limit = 10 } = await req.json()

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'VAL_001: クエリは2文字以上で入力してください' },
      { status: 400 }
    )
  }

  // クエリをベクトル化
  const { data: embData } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })
  const embedding = embData[0].embedding

  // pgvector semantic search
  const { data, error } = await supabase.rpc('search_subsidies', {
    query_embedding: embedding,
    filter_prefecture: prefecture ?? null,
    match_count: Math.min(limit, 20), // 最大20件
  })

  if (error) {
    console.error('search_subsidies RPC error:', error)
    return NextResponse.json(
      { error: 'DB_001: 検索に失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({ subsidies: data ?? [] })
}

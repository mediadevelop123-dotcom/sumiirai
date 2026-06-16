/**
 * app/api/v1/saved/route.ts
 *
 * GET  /api/v1/saved — 保存済み成果物一覧を取得
 * POST /api/v1/saved — 成果物を新規保存
 *
 * 認証: Cookie セッション（Supabase Auth）。未ログインは 401。
 */

import { getUser } from '@/lib/supabase-server'
import { listSavedOutputs, addSavedOutput } from '@/lib/saved-store'

// ─── GET ──────────────────────────────────────────────────────

export async function GET() {
  const user = await getUser()
  if (!user) {
    return Response.json(
      { error: 'AUTH_001: ログインが必要です' },
      { status: 401 }
    )
  }

  try {
    const items = await listSavedOutputs(user.id)
    return Response.json({ items })
  } catch (e) {
    console.error('[saved] GET 失敗:', e)
    return Response.json(
      { error: 'SAVED_001: 一覧取得に失敗しました' },
      { status: 500 }
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) {
    return Response.json(
      { error: 'AUTH_001: ログインが必要です' },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { error: 'VAL_001: リクエストボディが不正です' },
      { status: 400 }
    )
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return Response.json(
      { error: 'VAL_002: content は必須です' },
      { status: 400 }
    )
  }

  const category = typeof body.category === 'string' ? body.category : null
  // title 未指定の場合は content 先頭30字を自動生成
  const title = typeof body.title === 'string' && body.title.trim()
    ? body.title.trim()
    : content.slice(0, 30)

  try {
    const item = await addSavedOutput(user.id, { title, content, category })
    return Response.json({ item }, { status: 201 })
  } catch (e) {
    console.error('[saved] POST 失敗:', e)
    return Response.json(
      { error: 'SAVED_002: 保存に失敗しました' },
      { status: 500 }
    )
  }
}

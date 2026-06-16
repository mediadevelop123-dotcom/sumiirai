/**
 * app/api/v1/saved-subsidies/route.ts
 *
 * GET  /api/v1/saved-subsidies — ブックマーク済み補助金一覧を取得
 * POST /api/v1/saved-subsidies — 補助金をブックマーク保存
 *
 * 認証: Cookie セッション（Supabase Auth）。未ログインは 401。
 */

import { getUser } from '@/lib/supabase-server'
import { listSavedSubsidies, addSavedSubsidy } from '@/lib/saved-subsidies-store'

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
    const items = await listSavedSubsidies(user.id)
    return Response.json({ items })
  } catch (e) {
    console.error('[saved-subsidies] GET 失敗:', e)
    return Response.json(
      { error: 'SAVEDSUB_001: 一覧取得に失敗しました' },
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

  // snapshot は必須（title/url を最低限含む）
  const snapshot = body.snapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return Response.json(
      { error: 'VAL_002: snapshot は必須です' },
      { status: 400 }
    )
  }
  const snapshotObj = snapshot as Record<string, unknown>
  if (!snapshotObj.title || !snapshotObj.url) {
    return Response.json(
      { error: 'VAL_003: snapshot.title と snapshot.url は必須です' },
      { status: 400 }
    )
  }

  const subsidyId = typeof body.subsidyId === 'string' ? body.subsidyId : null
  const deadline  = typeof body.deadline  === 'string' ? body.deadline  : null

  try {
    const item = await addSavedSubsidy(user.id, {
      subsidyId,
      snapshot: snapshotObj as Parameters<typeof addSavedSubsidy>[1]['snapshot'],
      deadline,
    })
    return Response.json({ item }, { status: 201 })
  } catch (e) {
    console.error('[saved-subsidies] POST 失敗:', e)
    return Response.json(
      { error: 'SAVEDSUB_002: 保存に失敗しました' },
      { status: 500 }
    )
  }
}

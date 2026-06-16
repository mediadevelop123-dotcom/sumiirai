/**
 * app/api/v1/profile/route.ts
 *
 * GET  /api/v1/profile — 店舗プロフィールを取得（未設定なら null）
 * PUT  /api/v1/profile — 店舗プロフィールを作成・更新
 *
 * 認証: Cookie セッション（Supabase Auth）。未ログインは 401。
 */

import { getUser } from '@/lib/supabase-server'
import { getStoreProfile, upsertStoreProfile } from '@/lib/store-profile'

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
    const profile = await getStoreProfile(user.id)
    return Response.json({ profile })
  } catch (e) {
    console.error('[profile] GET 失敗:', e)
    return Response.json(
      { error: 'PROFILE_001: プロフィール取得に失敗しました' },
      { status: 500 }
    )
  }
}

// ─── PUT ──────────────────────────────────────────────────────

export async function PUT(req: Request) {
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

  // 受け入れるフィールドを明示（余計なキーを弾く）
  const allowed = ['store_name', 'industry', 'prefecture', 'city', 'customer_base', 'tone', 'notes'] as const
  type AllowedKey = typeof allowed[number]
  const fields: Partial<Record<AllowedKey, string | null>> = {}
  for (const key of allowed) {
    if (key in body) {
      const val = body[key]
      fields[key] = (typeof val === 'string' && val.trim() !== '') ? val.trim() : null
    }
  }

  try {
    const profile = await upsertStoreProfile(user.id, fields)
    return Response.json({ profile })
  } catch (e) {
    console.error('[profile] PUT 失敗:', e)
    return Response.json(
      { error: 'PROFILE_002: プロフィール保存に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/admin/users/[id]
 *   Body: { role?: string, orgId?: string | null }
 *   - ロール変更（member / org_admin / super_admin）
 *   - 会社移動（super_admin のみ）
 *
 * DELETE /api/v1/admin/users/[id]
 *   - ユーザーを組織から除外（org_id = null, role = member）
 *
 * 権限:
 *   super_admin: 全ユーザーを操作可
 *   org_admin  : 自社の member ↔ org_admin のみ変更可、super_admin は不可
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminProfile } from '@/lib/admin-auth'
import { getServiceClient } from '@/lib/supabase'

// ─── 共通: ターゲットのプロフィール取得 + 権限チェック ───────────
async function resolveTarget(targetId: string) {
  const profile = await getAdminProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const

  const sc = getServiceClient()
  const { data: target, error } = await sc
    .from('user_profiles')
    .select('user_id, role, org_id')
    .eq('user_id', targetId)
    .maybeSingle()

  if (error || !target) return { error: 'Not found', status: 404 } as const

  // org_admin は自社ユーザーのみ操作可
  if (profile.role === 'org_admin') {
    if (target.org_id !== profile.orgId) return { error: 'Forbidden', status: 403 } as const
    if (target.role === 'super_admin')   return { error: 'Forbidden', status: 403 } as const
  }

  return { profile, target, sc }
}

// ─── PATCH: ロール変更 / 会社移動 ────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolved = await resolveTarget(params.id)
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }
  const { profile, sc } = resolved

  const body = await req.json().catch(() => ({}))
  const newRole:  string | undefined       = typeof body.role  === 'string' ? body.role  : undefined
  const newOrgId: string | null | undefined = body.orgId !== undefined ? (body.orgId || null) : undefined

  // org_admin は super_admin へのロール変更を禁止
  if (profile.role === 'org_admin' && newRole === 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // org_admin は会社移動を禁止（自社固定）
  if (profile.role === 'org_admin' && newOrgId !== undefined) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const update: Record<string, string | null> = {}
  if (newRole  !== undefined) update.role   = newRole
  if (newOrgId !== undefined) update.org_id = newOrgId

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '変更内容がありません' }, { status: 400 })
  }

  const { error } = await sc
    .from('user_profiles')
    .update(update)
    .eq('user_id', params.id)

  if (error) {
    console.error('[admin/users PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE: 組織から除外 ─────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolved = await resolveTarget(params.id)
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }
  const { sc } = resolved

  const { error } = await sc
    .from('user_profiles')
    .update({ org_id: null, role: 'member' })
    .eq('user_id', params.id)

  if (error) {
    console.error('[admin/users DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

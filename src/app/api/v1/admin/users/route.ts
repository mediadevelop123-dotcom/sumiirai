/**
 * GET /api/v1/admin/users
 *
 * ユーザー一覧を返す。
 *   super_admin : 全ユーザー（org_id に関係なく）
 *   org_admin   : 自社のユーザーのみ
 *
 * レスポンス:
 *   { users: UserRow[] }
 *
 * UserRow:
 *   id, email, role, orgId, orgName,
 *   sessionCount, lastActive, createdAt
 */

import { NextResponse } from 'next/server'
import { getAdminProfile } from '@/lib/admin-auth'
import { getServiceClient } from '@/lib/supabase'

export async function GET() {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sc = getServiceClient()

  // ── 1. user_profiles 取得（ロール別フィルタ）───────────────
  let query = sc
    .from('user_profiles')
    .select('user_id, role, org_id, created_at, organizations(id, name, slug)')
    .order('created_at', { ascending: false })

  if (profile.role === 'org_admin') {
    query = query.eq('org_id', profile.orgId!)
  }

  const { data: profiles, error: pErr } = await query
  if (pErr) {
    console.error('[admin/users] profiles error:', pErr)
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  if (!profiles?.length) {
    return NextResponse.json({ users: [] })
  }

  // ── 2. auth.users からメール取得 ──────────────────────────
  const { data: authData, error: aErr } = await sc.auth.admin.listUsers({ perPage: 1000 })
  if (aErr) {
    console.error('[admin/users] auth.admin.listUsers error:', aErr)
  }
  const emailMap = new Map(
    (authData?.users ?? []).map(u => [u.id, { email: u.email ?? '—', createdAt: u.created_at }])
  )

  // ── 3. chat_sessions でセッション数・最終利用日を集計 ──────
  const userIds = profiles.map(p => p.user_id)
  const { data: sessions } = await sc
    .from('chat_sessions')
    .select('user_id, last_message_at')
    .in('user_id', userIds)

  const statsMap = new Map<string, { sessionCount: number; lastActive: string | null }>()
  for (const s of sessions ?? []) {
    const prev = statsMap.get(s.user_id) ?? { sessionCount: 0, lastActive: null }
    prev.sessionCount++
    if (
      s.last_message_at &&
      (!prev.lastActive || s.last_message_at > prev.lastActive)
    ) {
      prev.lastActive = s.last_message_at
    }
    statsMap.set(s.user_id, prev)
  }

  // ── 4. マージ ─────────────────────────────────────────────
  const users = profiles.map(p => {
    const auth    = emailMap.get(p.user_id)
    const stats   = statsMap.get(p.user_id) ?? { sessionCount: 0, lastActive: null }
    const org     = (Array.isArray(p.organizations) ? p.organizations[0] : p.organizations) as { id: string; name: string; slug: string } | null | undefined

    return {
      id:           p.user_id,
      email:        auth?.email ?? '—',
      role:         p.role,
      orgId:        p.org_id   ?? null,
      orgName:      org?.name  ?? null,
      sessionCount: stats.sessionCount,
      lastActive:   stats.lastActive,
      createdAt:    auth?.createdAt ?? p.created_at,
    }
  })

  return NextResponse.json({ users })
}

/**
 * GET /api/v1/admin/usage — 会社別使用量集計
 *
 * クエリパラメータ:
 *   range: 'today' | 'week' | 'month' | 'all'  (デフォルト: 'month')
 *
 * super_admin: 全社の使用量
 * org_admin  : 自社のみ
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminProfile } from '@/lib/admin-auth'
import { getServiceClient } from '@/lib/supabase'

function getStartDate(range: string): string | null {
  const now = new Date()
  switch (range) {
    case 'today': {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return d.toISOString()
    }
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString()
    }
    case 'month': {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return d.toISOString()
    }
    default:
      return null  // 全期間
  }
}

export async function GET(req: NextRequest) {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const range = req.nextUrl.searchParams.get('range') ?? 'month'
  const startDate = getStartDate(range)

  const supabase = getServiceClient()

  // ── 対象会社を取得 ─────────────────────────────────────────
  let orgQuery = supabase
    .from('organizations')
    .select('id, name, slug, plan')
    .eq('is_active', true)
    .order('name')

  if (profile.role === 'org_admin' && profile.orgId) {
    orgQuery = orgQuery.eq('id', profile.orgId)
  }

  const { data: orgs, error: orgErr } = await orgQuery
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 })

  // ── セッション数・メッセージ数を集計 ───────────────────────
  // sessions: org_id ごとに件数 + 最終利用日
  let sessionQuery = supabase
    .from('chat_sessions')
    .select('org_id, id, last_message_at, created_at')
    .not('org_id', 'is', null)

  if (startDate) {
    sessionQuery = sessionQuery.gte('created_at', startDate)
  }
  if (profile.role === 'org_admin' && profile.orgId) {
    sessionQuery = sessionQuery.eq('org_id', profile.orgId)
  }

  const { data: sessions } = await sessionQuery

  // セッションIDの配列（メッセージ数取得用）
  const sessionIds = (sessions ?? []).map(s => s.id)

  // メッセージ数（role='user' のみカウント = ユーザー発言数）
  let msgCount = 0
  const msgCountBySession: Record<string, number> = {}

  if (sessionIds.length > 0) {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('session_id, role')
      .in('session_id', sessionIds)
      .eq('role', 'user')

    for (const m of messages ?? []) {
      msgCountBySession[m.session_id] = (msgCountBySession[m.session_id] ?? 0) + 1
      msgCount++
    }
  }

  // org_id ごとに集計
  const statsByOrg: Record<string, {
    sessionCount: number
    msgCount:     number
    lastActive:   string | null
  }> = {}

  for (const s of sessions ?? []) {
    if (!s.org_id) continue
    if (!statsByOrg[s.org_id]) {
      statsByOrg[s.org_id] = { sessionCount: 0, msgCount: 0, lastActive: null }
    }
    statsByOrg[s.org_id].sessionCount++
    statsByOrg[s.org_id].msgCount += msgCountBySession[s.id] ?? 0
    const ts = s.last_message_at ?? s.created_at
    if (!statsByOrg[s.org_id].lastActive || ts > statsByOrg[s.org_id].lastActive!) {
      statsByOrg[s.org_id].lastActive = ts
    }
  }

  // ── 結果を整形 ───────────────────────────────────────────────
  const result = (orgs ?? []).map(org => ({
    id:           org.id,
    name:         org.name,
    slug:         org.slug,
    plan:         org.plan,
    sessionCount: statsByOrg[org.id]?.sessionCount ?? 0,
    msgCount:     statsByOrg[org.id]?.msgCount     ?? 0,
    lastActive:   statsByOrg[org.id]?.lastActive   ?? null,
  }))

  return NextResponse.json({ usage: result, range })
}

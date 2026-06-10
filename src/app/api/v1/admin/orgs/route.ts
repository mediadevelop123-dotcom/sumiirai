/**
 * GET  /api/v1/admin/orgs — 会社一覧（ユーザー数付き）
 * POST /api/v1/admin/orgs — 会社作成
 *
 * super_admin のみアクセス可。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminProfile } from '@/lib/admin-auth'
import { getServiceClient } from '@/lib/supabase'

// ─── GET: 会社一覧 ────────────────────────────────────────────
export async function GET() {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = getServiceClient()

  // 会社一覧 + 各社のユーザー数を一括取得
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/orgs] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ユーザー数を各社ごとに集計
  const { data: counts } = await supabase
    .from('user_profiles')
    .select('org_id')
    .not('org_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    if (row.org_id) countMap[row.org_id] = (countMap[row.org_id] ?? 0) + 1
  }

  const result = (orgs ?? []).map(org => ({
    ...org,
    userCount: countMap[org.id] ?? 0,
  }))

  return NextResponse.json({ orgs: result })
}

// ─── POST: 会社作成 ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const name: string = typeof body.name === 'string' ? body.name.trim() : ''
  const slug: string = typeof body.slug === 'string' ? body.slug.trim() : ''
  const plan: string = typeof body.plan === 'string' ? body.plan : 'trial'

  if (!name || !slug) {
    return NextResponse.json({ error: 'name と slug は必須です' }, { status: 400 })
  }
  // slug バリデーション: 英数字・ハイフンのみ
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'slug は半角英小文字・数字・ハイフンのみ使えます' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name, slug, plan })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'この slug はすでに使用されています' }, { status: 409 })
    }
    console.error('[admin/orgs] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ org: data }, { status: 201 })
}

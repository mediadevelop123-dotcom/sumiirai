/**
 * POST /api/v1/admin/invite
 * action: 'link'     → 招待リンクを生成して返す (メール送信なし)
 * action: 'register' → ユーザーをサイレントに登録するだけ
 *
 * 変更点 (Phase 2):
 *   - 管理者チェックを ADMIN_EMAILS 環境変数 → user_profiles.role に変更
 *   - orgId パラメータを受け付け、ユーザー作成後に user_profiles へ登録
 *   - super_admin は任意の org へ招待可、org_admin は自社のみ
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminProfile } from '@/lib/admin-auth'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  // ① ログイン・管理者チェック（DB ロール確認）
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const email:    string = typeof body.email    === 'string' ? body.email.trim()    : ''
  const action:   string = typeof body.action   === 'string' ? body.action          : 'link'
  const password: string = typeof body.password === 'string' ? body.password.trim() : ''
  const orgId:    string = typeof body.orgId    === 'string' ? body.orgId.trim()    : ''

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  // ② org_admin は自社のみ招待可（orgId を強制上書き）
  const resolvedOrgId = profile.role === 'org_admin'
    ? (profile.orgId ?? null)
    : (orgId || null)

  const adminClient = getServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sumiirai.vercel.app'

  // ③ リンク生成モード
  if (action === 'link') {
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${appUrl}/auth/callback?next=/account/setup` },
    })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return NextResponse.json({ error: 'already_exists' }, { status: 409 })
      }
      console.error('[admin/invite] generateLink error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // user_profiles に org + role を登録（ベストエフォート）
    await upsertUserProfile(adminClient, data.user.id, resolvedOrgId, 'member')

    return NextResponse.json({ link: data.properties.action_link })
  }

  // ④ 登録のみモード
  if (!password) return NextResponse.json({ error: 'password is required' }, { status: 400 })

  const { data: created, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return NextResponse.json({ error: 'already_exists' }, { status: 409 })
    }
    console.error('[admin/invite] createUser error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // user_profiles に org + role を登録（ベストエフォート）
  await upsertUserProfile(adminClient, created.user.id, resolvedOrgId, 'member')

  console.log(`[admin/register] registered: ${email} → org: ${resolvedOrgId ?? 'none'} by ${profile.email}`)
  return NextResponse.json({ ok: true })
}

// ─── ヘルパー ──────────────────────────────────────────────────
async function upsertUserProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  userId: string,
  orgId: string | null,
  role: string
) {
  try {
    await client
      .from('user_profiles')
      .upsert(
        { user_id: userId, org_id: orgId, role },
        { onConflict: 'user_id' }
      )
  } catch (e) {
    console.error('[admin/invite] user_profiles upsert failed:', e)
  }
}

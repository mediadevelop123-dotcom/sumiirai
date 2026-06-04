/**
 * POST /api/v1/admin/invite
 * action: 'link'     → 招待リンクを生成して返す (メール送信なし)
 * action: 'register' → ユーザーをサイレントに登録するだけ (リンクもメールも不要)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { getServiceClient } from '@/lib/supabase'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export async function POST(req: NextRequest) {
  // ① ログイン・管理者チェック
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const email    = typeof body.email    === 'string' ? body.email.trim()    : ''
  const action   = typeof body.action   === 'string' ? body.action          : 'link'
  const password = typeof body.password === 'string' ? body.password.trim() : ''
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const adminClient = getServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sumiirai.vercel.app'

  // ② リンク生成モード
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
    return NextResponse.json({ link: data.properties.action_link })
  }

  // ③ 登録のみモード (リンク不要・メール不要)
  if (!password) return NextResponse.json({ error: 'password is required' }, { status: 400 })

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 確認メール送らず即有効化
  })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return NextResponse.json({ error: 'already_exists' }, { status: 409 })
    }
    console.error('[admin/invite] createUser error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[admin/register] registered: ${email} by ${user.email}`)
  return NextResponse.json({ ok: true })
}

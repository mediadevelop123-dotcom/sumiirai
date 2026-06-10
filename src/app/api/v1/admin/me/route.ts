/**
 * GET /api/v1/admin/me — ログイン中の管理者情報を返す
 * role / orgId / orgName を返す（クライアント側のUI分岐用）
 */

import { NextResponse } from 'next/server'
import { getAdminProfile } from '@/lib/admin-auth'
import { getServiceClient } from '@/lib/supabase'

export async function GET() {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // org_admin の場合は自社名も返す
  let orgName: string | null = null
  if (profile.orgId) {
    const supabase = getServiceClient()
    const { data } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', profile.orgId)
      .maybeSingle()
    orgName = data?.name ?? null
  }

  return NextResponse.json({
    role:    profile.role,
    orgId:   profile.orgId,
    orgName,
    email:   profile.email,
  })
}

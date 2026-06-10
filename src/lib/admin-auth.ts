/**
 * lib/admin-auth.ts — 管理者ロール確認ヘルパー（サーバーサイド専用）
 *
 * ADMIN_EMAILS 環境変数の代わりに user_profiles テーブルのロールで判定する。
 * super_admin / org_admin どちらもアクセス可能。
 */

import { getUser } from '@/lib/supabase-server'
import { getServiceClient } from '@/lib/supabase'

export type AdminRole = 'super_admin' | 'org_admin'

export interface AdminProfile {
  userId: string
  email:  string
  role:   AdminRole
  orgId:  string | null  // super_admin は null
}

/**
 * ログインユーザーの管理者プロフィールを返す。
 * 未ログイン・権限なしの場合は null。
 */
export async function getAdminProfile(): Promise<AdminProfile | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = getServiceClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('role, org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data || !['super_admin', 'org_admin'].includes(data.role)) return null

  return {
    userId: user.id,
    email:  user.email ?? '',
    role:   data.role as AdminRole,
    orgId:  data.org_id ?? null,
  }
}

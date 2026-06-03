/**
 * GET /api/v1/sessions — ログインユーザーのチャットセッション一覧
 */

import { getUser } from '@/lib/supabase-server'
import { listSessions } from '@/lib/chat-store'

export async function GET() {
  const user = await getUser()
  if (!user) {
    return Response.json({ error: 'AUTH_001: ログインが必要です' }, { status: 401 })
  }

  try {
    const sessions = await listSessions(user.id, { limit: 50 })
    return Response.json(sessions)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

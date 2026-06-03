/**
 * GET /api/v1/sessions/[id]/messages — セッションのメッセージ一覧(時系列昇順)
 */

import { getUser } from '@/lib/supabase-server'
import { getMessages } from '@/lib/chat-store'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser()
  if (!user) {
    return Response.json({ error: 'AUTH_001: ログインが必要です' }, { status: 401 })
  }

  try {
    const messages = await getMessages(params.id, user.id)
    return Response.json(messages)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

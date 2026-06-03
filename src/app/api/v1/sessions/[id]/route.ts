/**
 * DELETE /api/v1/sessions/[id] — セッションをアーカイブ(論理削除)
 */

import { getUser } from '@/lib/supabase-server'
import { archiveSession } from '@/lib/chat-store'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser()
  if (!user) {
    return Response.json({ error: 'AUTH_001: ログインが必要です' }, { status: 401 })
  }

  try {
    await archiveSession(params.id, user.id, true)
    return new Response(null, { status: 204 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

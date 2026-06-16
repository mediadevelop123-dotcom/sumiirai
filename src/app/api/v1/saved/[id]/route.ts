/**
 * app/api/v1/saved/[id]/route.ts
 *
 * DELETE /api/v1/saved/[id] — 保存済み成果物を削除
 *
 * 認証: Cookie セッション（Supabase Auth）。未ログインは 401。
 */

import { getUser } from '@/lib/supabase-server'
import { deleteSavedOutput } from '@/lib/saved-store'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser()
  if (!user) {
    return Response.json(
      { error: 'AUTH_001: ログインが必要です' },
      { status: 401 }
    )
  }

  try {
    await deleteSavedOutput(params.id, user.id)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[saved/[id]] DELETE 失敗:', e)
    return Response.json(
      { error: 'SAVED_003: 削除に失敗しました' },
      { status: 500 }
    )
  }
}

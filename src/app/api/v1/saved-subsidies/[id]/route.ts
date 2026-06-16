/**
 * app/api/v1/saved-subsidies/[id]/route.ts
 *
 * DELETE /api/v1/saved-subsidies/[id] — ブックマーク済み補助金を削除
 *
 * 認証: Cookie セッション（Supabase Auth）。未ログインは 401。
 */

import { getUser } from '@/lib/supabase-server'
import { deleteSavedSubsidy } from '@/lib/saved-subsidies-store'

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
    await deleteSavedSubsidy(params.id, user.id)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[saved-subsidies/[id]] DELETE 失敗:', e)
    return Response.json(
      { error: 'SAVEDSUB_003: 削除に失敗しました' },
      { status: 500 }
    )
  }
}

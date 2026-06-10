'use client'

/**
 * AdminHeader — 管理コンソール用ヘッダー
 * 表示内容: ロゴ / 管理コンソールラベル / ロール+会社名バッジ / チャットへ / ログアウト
 */

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type AdminRole = 'super_admin' | 'org_admin'

export default function AdminHeader({
  role,
  orgName,
  email,
}: {
  role:     AdminRole
  orgName?: string | null
  email?:   string | null
}) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isSuperAdmin = role === 'super_admin'
  const roleLabel    = isSuperAdmin ? 'スーパー管理者' : '会社管理者'
  const badgeClass   = isSuperAdmin
    ? 'bg-purple-100 text-purple-700 border border-purple-200'
    : 'bg-blue-100 text-blue-700 border border-blue-200'

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm z-10 shrink-0">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">

        {/* ── ロゴ ── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-2xl select-none">🤖</span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-gray-900">補助金相談 AI</p>
            <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">
              管理コンソール
            </p>
          </div>
        </div>

        {/* 縦線区切り */}
        <div className="hidden sm:block h-6 w-px bg-gray-200 shrink-0 mx-1" />

        {/* ── ロール / 会社バッジ ── */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
          <span>{isSuperAdmin ? '👑' : '🏢'}</span>
          <span>{roleLabel}</span>
          {orgName && (
            <>
              <span className="opacity-40">—</span>
              <span className="max-w-[120px] truncate">{orgName}</span>
            </>
          )}
        </div>

        {/* スペーサー */}
        <div className="flex-1" />

        {/* ── ユーザー email (PC のみ) ── */}
        {email && (
          <span className="hidden md:block text-xs text-gray-400 truncate max-w-[180px]">
            {email}
          </span>
        )}

        {/* ── チャットに戻る ── */}
        <button
          onClick={() => router.push('/chat')}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500
                     hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50
                     transition-colors whitespace-nowrap border border-gray-200
                     hover:border-blue-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="hidden sm:inline">チャットに戻る</span>
          <span className="sm:hidden">チャット</span>
        </button>

        {/* ── ログアウト ── */}
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors
                     px-2.5 py-1.5 rounded-lg hover:bg-gray-100 whitespace-nowrap"
          title="ログアウト"
        >
          ↩ ログアウト
        </button>
      </div>
    </header>
  )
}

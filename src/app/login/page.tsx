'use client'

/**
 * app/login/page.tsx — ログイン
 * 通常: メール＋パスワード認証
 * パスワード忘れ: マジックリンク送信
 */

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

function LoginForm() {
  const searchParams = useSearchParams()
  const next      = searchParams.get('next') ?? '/chat'
  const authError = searchParams.get('error')

  const [mode, setMode]     = useState<'password' | 'magic'>('password')
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  // ── パスワードログイン ──────────────────────────────────────────
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password || status === 'sending') return

    setStatus('sending')
    setErrMsg('')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setStatus('error')
      const msg = error.message.toLowerCase()
      if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found')) {
        setErrMsg('メールアドレスまたはパスワードが正しくありません。')
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        setErrMsg('試行回数が多すぎます。しばらく時間をおいてから再度お試しください。')
      } else {
        setErrMsg('ログインに失敗しました。時間をおいて再度お試しください。')
      }
    } else {
      // ログイン成功 → next へリダイレクト
      window.location.href = next
    }
  }

  // ── マジックリンク (パスワード忘れ用) ──────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || status === 'sending') return

    setStatus('sending')
    setErrMsg('')

    const supabase = createSupabaseBrowserClient()
    const emailRedirectTo =
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo, shouldCreateUser: false },
    })

    if (error) {
      setStatus('error')
      const msg = error.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setErrMsg('送信回数の上限に達しました。しばらく時間をおいてから再度お試しください。')
      } else if (msg.includes('not found') || msg.includes('invalid') || msg.includes('signups not allowed') || msg.includes('user not found')) {
        setErrMsg('このメールアドレスは登録されていません。管理者にお問い合わせください。')
      } else {
        setErrMsg('送信に失敗しました。時間をおいて再度お試しください。')
      }
    } else {
      setStatus('sent')
    }
  }

  // ── メール送信完了画面 ─────────────────────────────────────────
  if (status === 'sent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-3">
          <p className="text-3xl">📩</p>
          <p className="text-sm text-gray-700 font-medium">ログインリンクを送信しました</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-medium">{email}</span> 宛のメールを開き、<br />
            リンクをクリックしてログインしてください。
          </p>
          <button
            onClick={() => { setStatus('idle'); setMode('password') }}
            className="text-xs text-blue-600 hover:underline mt-2"
          >
            ← ログイン画面に戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🤖</p>
          <h1 className="text-lg font-bold text-gray-900">補助金相談 AI</h1>
          <p className="text-xs text-gray-400 mt-1">β版 — ログイン</p>
        </div>

        {mode === 'password' ? (
          /* ── パスワードログインフォーム ── */
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {(status === 'error' || authError) && (
              <p className="text-xs text-red-500">
                {errMsg || 'ログインに失敗しました。もう一度お試しください。'}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending' || !email.trim() || !password}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white
                         hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {status === 'sending' ? 'ログイン中…' : 'ログイン'}
            </button>

            <p className="text-center">
              <button
                type="button"
                onClick={() => { setMode('magic'); setStatus('idle'); setErrMsg('') }}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                パスワードを忘れた場合
              </button>
            </p>
          </form>
        ) : (
          /* ── マジックリンクフォーム (パスワード忘れ用) ── */
          <form onSubmit={handleMagicLink} className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              登録済みのメールアドレスにログイン用リンクをお送りします。
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {status === 'error' && (
              <p className="text-xs text-red-500">{errMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending' || !email.trim()}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white
                         hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {status === 'sending' ? '送信中…' : 'ログインリンクを送信'}
            </button>

            <p className="text-center">
              <button
                type="button"
                onClick={() => { setMode('password'); setStatus('idle'); setErrMsg('') }}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                ← パスワードでログイン
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

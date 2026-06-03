'use client'

/**
 * app/login/page.tsx — マジックリンクログイン
 * アクセス: /login?next=/chat
 *
 * メールアドレスにワンタイムのログインリンクを送信する方式 (パスワード不要)。
 * β版は社内・グループ会社のみのため、シンプルな OTP メールで運用する。
 */

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/chat'
  const authError = searchParams.get('error')

  const [email, setEmail]   = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || status === 'sending') return

    setStatus('sending')
    setErrMsg('')

    const supabase = createSupabaseBrowserClient()
    const emailRedirectTo =
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo },
    })

    if (error) {
      setStatus('error')
      setErrMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🤖</p>
          <h1 className="text-lg font-bold text-gray-900">補助金相談 AI</h1>
          <p className="text-xs text-gray-400 mt-1">β版 — ログイン</p>
        </div>

        {status === 'sent' ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-3xl">📩</p>
            <p className="text-sm text-gray-700 font-medium">
              ログインリンクを送信しました
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-medium">{email}</span> 宛のメールを開き、<br />
              リンクをクリックしてログインしてください。
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="text-xs text-blue-600 hover:underline mt-2"
            >
              別のメールアドレスで送信
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {(status === 'error' || authError) && (
              <p className="text-xs text-red-500">
                {errMsg || 'ログインに失敗しました。もう一度お試しください。'}
              </p>
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

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              パスワードは不要です。入力したメールアドレスに<br />
              ログイン用リンクをお送りします。
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

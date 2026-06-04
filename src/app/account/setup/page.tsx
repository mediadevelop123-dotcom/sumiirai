'use client'

/**
 * /account/setup — 初回パスワード設定
 * 招待リンクでログイン後にリダイレクトされるページ。
 * パスワードを設定すると次回からメール＋パスワードでログインできる。
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function AccountSetupPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [status, setStatus]     = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirm) {
      setErrMsg('パスワードが一致しません')
      return
    }
    if (password.length < 8) {
      setErrMsg('パスワードは8文字以上にしてください')
      return
    }

    setStatus('saving')
    setErrMsg('')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setErrMsg('設定に失敗しました。もう一度お試しください。')
    } else {
      setStatus('done')
      setTimeout(() => router.push('/chat'), 1500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🔐</p>
          <h1 className="text-lg font-bold text-gray-900">パスワードを設定</h1>
          <p className="text-xs text-gray-400 mt-1">
            次回からはメール＋パスワードでログインできます
          </p>
        </div>

        {status === 'done' ? (
          <div className="text-center space-y-2 py-4">
            <p className="text-3xl">✅</p>
            <p className="text-sm text-gray-700 font-medium">パスワードを設定しました</p>
            <p className="text-xs text-gray-400">チャット画面に移動します…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                新しいパスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8文字以上"
                required
                minLength={8}
                autoFocus
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                パスワード（確認）
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="もう一度入力"
                required
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {errMsg && (
              <p className="text-xs text-red-500">{errMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'saving' || !password || !confirm}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white
                         hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {status === 'saving' ? '設定中…' : 'パスワードを設定する'}
            </button>

            <p className="text-center">
              <button
                type="button"
                onClick={() => router.push('/chat')}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                スキップしてチャットへ →
              </button>
            </p>
          </form>
        )}

      </div>
    </div>
  )
}

'use client'

/**
 * /admin/invite — ユーザー管理ページ (管理者専用)
 *
 * ① 招待リンク生成：メアド1件 → リンクをコピーして LINE/メール等で手動共有
 * ② 一括登録：複数メアドを貼り付けて一括登録（ユーザーは後で /login から入る）
 */

import { useState, useRef } from 'react'

// ─── 型定義 ───────────────────────────────────────────────────────────────
type Tab = 'link' | 'bulk'

interface BulkResult {
  email: string
  status: 'ok' | 'already' | 'error'
  message: string
}

// ─── ユーティリティ ────────────────────────────────────────────────────────
async function callApi(email: string, action: 'link' | 'register', password?: string) {
  const res = await fetch('/api/v1/admin/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, action, password }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

// ─── 招待リンク生成タブ ────────────────────────────────────────────────────
function LinkTab() {
  const [email, setEmail]   = useState('')
  const [link, setLink]     = useState('')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    setLink('')
    setErrMsg('')
    setCopied(false)

    const { ok, status, data } = await callApi(email.trim(), 'link')
    setLoading(false)

    if (ok) {
      setLink(data.link)
    } else if (status === 409) {
      setErrMsg('このメールアドレスはすでに登録されています')
    } else {
      setErrMsg(data.error ?? 'エラーが発生しました')
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        メールアドレスを入力してリンクを生成し、LINE・チャット等で手動共有してください。
        リンクをクリックするとその場でログインできます。
      </p>

      <form onSubmit={handleGenerate} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="customer@example.com"
          required
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors whitespace-nowrap"
        >
          {loading ? '生成中…' : 'リンクを生成'}
        </button>
      </form>

      {errMsg && (
        <p className="text-sm text-red-500">{errMsg}</p>
      )}

      {link && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">生成されたリンク</label>
          <div className="flex gap-2 items-start">
            <textarea
              readOnly
              value={link}
              rows={3}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2
                         text-xs text-gray-700 resize-none focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm
                         hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              {copied ? '✅ コピー済' : '📋 コピー'}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            ⚠ このリンクは一度だけ有効です。再発行が必要な場合は再度生成してください。
          </p>
        </div>
      )}
    </div>
  )
}

// ─── 一括登録タブ ──────────────────────────────────────────────────────────
function BulkTab() {
  const [text, setText]         = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [results, setResults]   = useState<BulkResult[]>([])
  const abortRef = useRef(false)

  function parseEmails(raw: string): string[] {
    // 改行・カンマ・スペース・全角スペース・タブ で分割し、重複除去
    return Array.from(new Set(
      raw
        .split(/[\n,\s　\t]+/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.includes('@'))
    ))
  }

  async function handleBulk(e: React.FormEvent) {
    e.preventDefault()
    const emails = parseEmails(text)
    if (emails.length === 0 || !password || loading) return

    abortRef.current = false
    setLoading(true)
    setResults([])

    for (const email of emails) {
      if (abortRef.current) break

      const { ok, status, data } = await callApi(email, 'register', password)
      const result: BulkResult = ok
        ? { email, status: 'ok',      message: '登録しました' }
        : status === 409
          ? { email, status: 'already', message: 'すでに登録済み' }
          : { email, status: 'error',   message: data.error ?? 'エラー' }

      setResults(prev => [...prev, result])
    }

    setLoading(false)
  }

  function handleStop() {
    abortRef.current = true
  }

  const okCount     = results.filter(r => r.status === 'ok').length
  const alreadyCount = results.filter(r => r.status === 'already').length
  const errCount    = results.filter(r => r.status === 'error').length

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        メールアドレスを改行・カンマ区切りで貼り付けて一括登録します。
        登録後はユーザーが <code className="bg-gray-100 px-1 rounded">/login</code> からログインできます。
      </p>

      <form onSubmit={handleBulk} className="space-y-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"aaa@example.com\nbbb@example.com\nccc@example.com"}
          rows={5}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
        />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            初期パスワード <span className="text-gray-400">（全ユーザー共通）</span>
          </label>
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="例: Welcome2024"
            required
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            このパスワードをユーザーに伝えてください。ログイン後に変更はできません（β版）。
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {!loading ? (
            <button
              type="submit"
              disabled={parseEmails(text).length === 0 || !password}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white
                         hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {parseEmails(text).length > 0
                ? `${parseEmails(text).length}件を一括登録`
                : '一括登録'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-medium text-white
                         hover:bg-red-600 transition-colors"
            >
              中止
            </button>
          )}
          {loading && (
            <span className="text-sm text-gray-500">
              処理中… {results.length} / {parseEmails(text).length}件
            </span>
          )}
        </div>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          {/* サマリー */}
          <div className="flex gap-4 text-sm">
            {okCount     > 0 && <span className="text-green-600">✅ 登録 {okCount}件</span>}
            {alreadyCount > 0 && <span className="text-yellow-600">⚠️ 既存 {alreadyCount}件</span>}
            {errCount    > 0 && <span className="text-red-500">❌ エラー {errCount}件</span>}
          </div>
          {/* 結果リスト */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">メールアドレス</th>
                  <th className="text-left px-4 py-2">結果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.email}</td>
                    <td className="px-4 py-2">
                      <span className={
                        r.status === 'ok'     ? 'text-green-600' :
                        r.status === 'already'? 'text-yellow-600' : 'text-red-500'
                      }>
                        {r.status === 'ok' ? '✅' : r.status === 'already' ? '⚠️' : '❌'}
                        {' '}{r.message}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── メインページ ──────────────────────────────────────────────────────────
export default function AdminInvitePage() {
  const [tab, setTab] = useState<Tab>('link')

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-lg space-y-6">

        <div>
          <h1 className="text-xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">管理者専用</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* タブ */}
          <div className="flex border-b border-gray-200">
            {([
              { key: 'link', label: '🔗 招待リンク生成' },
              { key: 'bulk', label: '📋 一括登録' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-medium transition-colors
                  ${tab === t.key
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/40'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* コンテンツ */}
          <div className="p-6">
            {tab === 'link' ? <LinkTab /> : <BulkTab />}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          登録済みユーザーは <code className="bg-gray-100 px-1 rounded">https://sumiirai.vercel.app/login</code> からログインできます。
        </p>
      </div>
    </div>
  )
}

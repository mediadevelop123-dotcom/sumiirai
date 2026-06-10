'use client'

/**
 * /admin/invite — 管理者ハブ (Phase 2)
 *
 * super_admin: 🏢 会社管理 / 🔗 招待リンク / 📋 一括登録
 * org_admin  :                🔗 招待リンク / 📋 一括登録
 *
 * 会社選択は super_admin のみ（org_admin は自社固定）
 */

import { useState, useEffect, useRef } from 'react'

// ─── 型定義 ───────────────────────────────────────────────────
type AdminRole = 'super_admin' | 'org_admin'
type Tab = 'orgs' | 'link' | 'bulk' | 'usage'

interface Org {
  id:        string
  name:      string
  slug:      string
  plan:      string
  is_active: boolean
  userCount: number
}

interface AdminCtx {
  role:  AdminRole
  orgId: string | null
  orgs:  Org[]
}

type UsageRange = 'today' | 'week' | 'month' | 'all'

interface UsageStat {
  id:           string
  name:         string
  slug:         string
  plan:         string
  sessionCount: number
  msgCount:     number
  lastActive:   string | null
}

interface BulkResult {
  email:   string
  status:  'ok' | 'already' | 'error'
  message: string
}

// ─── API ヘルパー ──────────────────────────────────────────────
async function fetchAdminCtx(): Promise<AdminCtx | null> {
  // 自分のロール取得
  const profileRes = await fetch('/api/v1/admin/me')
  if (!profileRes.ok) return null
  const profile = await profileRes.json()

  // super_admin のみ orgs リストを取得
  let orgs: Org[] = []
  if (profile.role === 'super_admin') {
    const orgsRes = await fetch('/api/v1/admin/orgs')
    if (orgsRes.ok) {
      const data = await orgsRes.json()
      orgs = data.orgs ?? []
    }
  }

  return { role: profile.role, orgId: profile.orgId, orgs }
}

async function callInviteApi(params: {
  email:     string
  action:    'link' | 'register'
  orgId?:    string
  password?: string
}) {
  const res = await fetch('/api/v1/admin/invite', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

// ─── 使用量タブ ───────────────────────────────────────────────
function UsageTab() {
  const [range,   setRange]   = useState<UsageRange>('month')
  const [stats,   setStats]   = useState<UsageStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/admin/usage?range=${range}`)
      .then(r => r.json())
      .then(d => { setStats(d.usage ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  const RANGE_LABELS: Record<UsageRange, string> = {
    today: '今日',
    week:  '過去7日',
    month: '過去30日',
    all:   '全期間',
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const totalSessions = stats.reduce((s, r) => s + r.sessionCount, 0)
  const totalMsgs     = stats.reduce((s, r) => s + r.msgCount, 0)

  return (
    <div className="space-y-4">
      {/* 期間セレクター */}
      <div className="flex gap-1">
        {(Object.keys(RANGE_LABELS) as UsageRange[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${range === r
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">読み込み中…</p>
      ) : stats.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">データがありません</p>
      ) : (
        <>
          {/* サマリー */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-600 font-medium">総セッション数</p>
              <p className="text-2xl font-bold text-blue-700 mt-0.5">{totalSessions.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-xl px-4 py-3">
              <p className="text-xs text-green-600 font-medium">総質問数</p>
              <p className="text-2xl font-bold text-green-700 mt-0.5">{totalMsgs.toLocaleString()}</p>
            </div>
          </div>

          {/* 会社別テーブル */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">会社名</th>
                  <th className="text-right px-4 py-2">セッション</th>
                  <th className="text-right px-4 py-2">質問数</th>
                  <th className="text-right px-4 py-2">最終利用</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.map(s => (
                  <tr key={s.id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.plan}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 font-mono">
                      {s.sessionCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 font-mono">
                      {s.msgCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                      {fmtDate(s.lastActive)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── 会社管理タブ（super_admin 専用）─────────────────────────
function OrgsTab({ orgs, onCreated }: { orgs: Org[]; onCreated: (org: Org) => void }) {
  const [name, setName]       = useState('')
  const [slug, setSlug]       = useState('')
  const [plan, setPlan]       = useState('trial')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg]   = useState('')

  // 会社名から slug を自動生成
  function autoSlug(n: string) {
    return n
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || loading) return
    setLoading(true)
    setErrMsg('')

    const res = await fetch('/api/v1/admin/orgs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: name.trim(), slug: slug.trim(), plan }),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      onCreated(data.org)
      setName('')
      setSlug('')
    } else {
      setErrMsg(data.error ?? 'エラーが発生しました')
    }
  }

  return (
    <div className="space-y-6">
      {/* 会社一覧 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">登録済み会社</h3>
        {orgs.length === 0 ? (
          <p className="text-sm text-gray-400">まだ会社が登録されていません</p>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">会社名</th>
                  <th className="text-left px-4 py-2">slug</th>
                  <th className="text-left px-4 py-2">プラン</th>
                  <th className="text-right px-4 py-2">ユーザー</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orgs.map(org => (
                  <tr key={org.id} className="bg-white">
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {org.name}
                      {!org.is_active && (
                        <span className="ml-2 text-xs text-red-500">停止中</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{org.slug}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${org.plan === 'pro'   ? 'bg-purple-100 text-purple-700' :
                          org.plan === 'basic' ? 'bg-blue-100 text-blue-700' :
                                                 'bg-gray-100 text-gray-600'}`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{org.userCount}人</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 会社作成フォーム */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">会社を追加</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">会社名</label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value)
                setSlug(autoSlug(e.target.value))
              }}
              placeholder="株式会社〇〇"
              required
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              slug <span className="text-gray-400">（半角英小文字・数字・ハイフン）</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="example-company"
              required
              pattern="[a-z0-9-]+"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-mono
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">プラン</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="trial">trial（無料）</option>
              <option value="basic">basic</option>
              <option value="pro">pro</option>
            </select>
          </div>

          {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim() || !slug.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white
                       hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading ? '作成中…' : '会社を作成'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── 会社セレクター（共通）────────────────────────────────────
function OrgSelector({
  orgs,
  value,
  onChange,
}: {
  orgs: Org[]
  value: string
  onChange: (id: string) => void
}) {
  if (orgs.length === 0) {
    return (
      <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-3 py-2.5">
        ⚠ 先に「会社管理」タブで会社を作成してください
      </p>
    )
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">招待先の会社</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">会社を選択…</option>
        {orgs.map(o => (
          <option key={o.id} value={o.id}>
            {o.name}（{o.plan}）
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── 招待リンク生成タブ ────────────────────────────────────────
function LinkTab({ ctx }: { ctx: AdminCtx }) {
  const [email,   setEmail]   = useState('')
  const [orgId,   setOrgId]   = useState(ctx.orgId ?? '')
  const [link,    setLink]    = useState('')
  const [loading, setLoading] = useState(false)
  const [errMsg,  setErrMsg]  = useState('')
  const [copied,  setCopied]  = useState(false)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading) return
    if (ctx.role === 'super_admin' && !orgId) {
      setErrMsg('招待先の会社を選択してください')
      return
    }
    setLoading(true)
    setLink('')
    setErrMsg('')
    setCopied(false)

    const { ok, status, data } = await callInviteApi({
      email: email.trim(),
      action: 'link',
      orgId,
    })
    setLoading(false)

    if (ok) {
      setLink(data.link)
    } else if (status === 409) {
      setErrMsg('このメールアドレスはすでに登録されています')
    } else {
      setErrMsg(data.error ?? 'エラーが発生しました')
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        メールアドレスを入力してリンクを生成し、LINE・チャット等で手動共有してください。
      </p>

      <form onSubmit={handleGenerate} className="space-y-3">
        {ctx.role === 'super_admin' && (
          <OrgSelector orgs={ctx.orgs} value={orgId} onChange={setOrgId} />
        )}
        {ctx.role === 'org_admin' && ctx.orgs.length > 0 && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
            招待先: <span className="font-medium">{ctx.orgs[0]?.name}</span>（自社固定）
          </p>
        )}

        <div className="flex gap-2">
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
            disabled={loading || !email.trim() || (ctx.role === 'super_admin' && !orgId)}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                       hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors whitespace-nowrap"
          >
            {loading ? '生成中…' : 'リンクを生成'}
          </button>
        </div>
      </form>

      {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}

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
              onClick={async () => {
                await navigator.clipboard.writeText(link)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm
                         hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              {copied ? '✅ コピー済' : '📋 コピー'}
            </button>
          </div>
          <p className="text-xs text-gray-400">⚠ このリンクは一度だけ有効です。</p>
        </div>
      )}
    </div>
  )
}

// ─── 一括登録タブ ──────────────────────────────────────────────
function BulkTab({ ctx }: { ctx: AdminCtx }) {
  const [text,     setText]     = useState('')
  const [orgId,    setOrgId]    = useState(ctx.orgId ?? '')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [results,  setResults]  = useState<BulkResult[]>([])
  const abortRef = useRef(false)

  function parseEmails(raw: string): string[] {
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
    if (ctx.role === 'super_admin' && !orgId) return

    abortRef.current = false
    setLoading(true)
    setResults([])

    for (const email of emails) {
      if (abortRef.current) break

      const { ok, status, data } = await callInviteApi({
        email,
        action: 'register',
        orgId,
        password,
      })
      const result: BulkResult = ok
        ? { email, status: 'ok',      message: '登録しました' }
        : status === 409
          ? { email, status: 'already', message: 'すでに登録済み' }
          : { email, status: 'error',   message: data.error ?? 'エラー' }

      setResults(prev => [...prev, result])
    }
    setLoading(false)
  }

  const emails      = parseEmails(text)
  const okCount     = results.filter(r => r.status === 'ok').length
  const alreadyCount = results.filter(r => r.status === 'already').length
  const errCount    = results.filter(r => r.status === 'error').length

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        メールアドレスを改行・カンマ区切りで貼り付けて一括登録します。
      </p>

      <form onSubmit={handleBulk} className="space-y-3">
        {ctx.role === 'super_admin' && (
          <OrgSelector orgs={ctx.orgs} value={orgId} onChange={setOrgId} />
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"aaa@example.com\nbbb@example.com"}
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
        </div>

        <div className="flex gap-2 items-center">
          {!loading ? (
            <button
              type="submit"
              disabled={
                emails.length === 0 || !password ||
                (ctx.role === 'super_admin' && !orgId)
              }
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white
                         hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {emails.length > 0 ? `${emails.length}件を一括登録` : '一括登録'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { abortRef.current = true }}
              className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-medium text-white
                         hover:bg-red-600 transition-colors"
            >
              中止
            </button>
          )}
          {loading && (
            <span className="text-sm text-gray-500">
              処理中… {results.length} / {emails.length}件
            </span>
          )}
        </div>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-4 text-sm">
            {okCount      > 0 && <span className="text-green-600">✅ 登録 {okCount}件</span>}
            {alreadyCount > 0 && <span className="text-yellow-600">⚠️ 既存 {alreadyCount}件</span>}
            {errCount     > 0 && <span className="text-red-500">❌ エラー {errCount}件</span>}
          </div>
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
                        r.status === 'ok'      ? 'text-green-600' :
                        r.status === 'already' ? 'text-yellow-600' : 'text-red-500'
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

// ─── メインページ ──────────────────────────────────────────────
export default function AdminInvitePage() {
  const [ctx,     setCtx]    = useState<AdminCtx | null>(null)
  const [tab,     setTab]    = useState<Tab>('link')
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState(false)

  useEffect(() => {
    fetchAdminCtx().then(result => {
      if (!result) {
        setDenied(true)
      } else {
        setCtx(result)
        // super_admin はデフォルトで会社管理タブ
        if (result.role === 'super_admin') setTab('orgs')
      }
      setLoading(false)
    })
  }, [])

  function handleOrgCreated(org: Org) {
    setCtx(prev => prev ? { ...prev, orgs: [org, ...prev.orgs] } : prev)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">読み込み中…</p>
      </div>
    )
  }

  if (denied || !ctx) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">アクセス権限がありません</p>
      </div>
    )
  }

  const tabs = [
    ...(ctx.role === 'super_admin' ? [{ key: 'orgs' as Tab, label: '🏢 会社管理' }] : []),
    { key: 'link'  as Tab, label: '🔗 招待リンク' },
    { key: 'bulk'  as Tab, label: '📋 一括登録' },
    { key: 'usage' as Tab, label: '📊 使用量' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-lg space-y-6">

        <div>
          <h1 className="text-xl font-bold text-gray-900">管理者ページ</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {ctx.role === 'super_admin' ? 'スーパー管理者' : '会社管理者'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* タブ */}
          <div className="flex border-b border-gray-200">
            {tabs.map(t => (
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
            {tab === 'orgs' && ctx.role === 'super_admin' && (
              <OrgsTab orgs={ctx.orgs} onCreated={handleOrgCreated} />
            )}
            {tab === 'link'  && <LinkTab ctx={ctx} />}
            {tab === 'bulk'  && <BulkTab ctx={ctx} />}
            {tab === 'usage' && <UsageTab />}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          登録済みユーザーは{' '}
          <code className="bg-gray-100 px-1 rounded">https://sumiirai.vercel.app/login</code>{' '}
          からログインできます。
        </p>
      </div>
    </div>
  )
}

'use client'

/**
 * /admin/invite — 管理者コンソール (Phase 2)
 *
 * super_admin: 👥 ユーザー管理 / 🏢 会社管理 / 🔗 招待 / 📋 一括登録 / 📊 使用量
 * org_admin  : 👥 ユーザー管理 /              🔗 招待 / 📋 一括登録 / 📊 使用量
 *
 * レイアウト: ダークサイドバー (240px) + ホワイトメインエリア (ChatGPT admin 風)
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// ─── 型定義 ───────────────────────────────────────────────────
type AdminRole = 'super_admin' | 'org_admin'
type Tab = 'users' | 'orgs' | 'link' | 'bulk' | 'usage'

interface Org {
  id:        string
  name:      string
  slug:      string
  plan:      string
  is_active: boolean
  userCount: number
}

interface AdminCtx {
  role:    AdminRole
  orgId:   string | null
  orgName: string | null
  email:   string | null
  orgs:    Org[]
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

interface UserRow {
  id:           string
  email:        string
  role:         string
  orgId:        string | null
  orgName:      string | null
  sessionCount: number
  lastActive:   string | null
  createdAt:    string
}

// ─── API ヘルパー ──────────────────────────────────────────────
async function fetchAdminCtx(): Promise<AdminCtx | null> {
  const profileRes = await fetch('/api/v1/admin/me')
  if (!profileRes.ok) return null
  const profile = await profileRes.json()

  let orgs: Org[] = []
  if (profile.role === 'super_admin') {
    const orgsRes = await fetch('/api/v1/admin/orgs')
    if (orgsRes.ok) {
      const data = await orgsRes.json()
      orgs = data.orgs ?? []
    }
  }

  return {
    role:    profile.role,
    orgId:   profile.orgId,
    orgName: profile.orgName ?? null,
    email:   profile.email   ?? null,
    orgs,
  }
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

// ─── アイコン ─────────────────────────────────────────────────
function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  )
}

function IconArrowLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  )
}

// ─── ユーザー管理タブ ─────────────────────────────────────────
function UsersTab({ ctx }: { ctx: AdminCtx }) {
  const [users,      setUsers]      = useState<UserRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [updating,   setUpdating]   = useState<string | null>(null)

  const isSuperAdmin = ctx.role === 'super_admin'

  useEffect(() => {
    setLoading(true)
    fetch('/api/v1/admin/users')
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function changeRole(userId: string, newRole: string) {
    setUpdating(userId)
    const res = await fetch(`/api/v1/admin/users/${userId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } else {
      alert('ロール変更に失敗しました')
    }
    setUpdating(null)
  }

  async function changeOrg(userId: string, newOrgId: string | null) {
    setUpdating(userId)
    const res = await fetch(`/api/v1/admin/users/${userId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ orgId: newOrgId }),
    })
    if (res.ok) {
      const orgName = newOrgId
        ? (ctx.orgs.find(o => o.id === newOrgId)?.name ?? null)
        : null
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, orgId: newOrgId, orgName } : u
      ))
    } else {
      alert('会社移動に失敗しました')
    }
    setUpdating(null)
  }

  async function removeFromOrg(userId: string, email: string) {
    if (!confirm(`「${email}」を組織から除外しますか？\nユーザーはログインできなくなります。`)) return
    setUpdating(userId)
    const res = await fetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => isSuperAdmin
        ? prev.map(u => u.id === userId ? { ...u, orgId: null, orgName: null, role: 'member' } : u)
        : prev.filter(u => u.id !== userId)
      )
    } else {
      alert('除外に失敗しました')
    }
    setUpdating(null)
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  function fmtDate(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
    if (diffDays === 0) return `今日 ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
    if (diffDays === 1) return '昨日'
    if (diffDays < 7)  return `${diffDays}日前`
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  }

  function fmtJoined(iso: string) {
    return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
  }

  function RoleBadge({ role }: { role: string }) {
    const cfg: Record<string, { label: string; cls: string }> = {
      super_admin: { label: '👑 スーパー管理者', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
      org_admin:   { label: '🏢 会社管理者',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
      member:      { label: '👤 メンバー',        cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    }
    const { label, cls } = cfg[role] ?? { label: role, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
        {label}
      </span>
    )
  }

  function availableRoles(currentRole: string): string[] {
    if (isSuperAdmin) return ['member', 'org_admin', 'super_admin']
    if (currentRole === 'super_admin') return []
    return ['member', 'org_admin']
  }

  const ROLE_LABELS: Record<string, string> = {
    super_admin: '👑 スーパー管理者',
    org_admin:   '🏢 会社管理者',
    member:      '👤 メンバー',
  }

  return (
    <div className="space-y-5">
      {/* 統計カード */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-medium text-gray-500">総ユーザー</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{users.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-medium text-gray-500">会社管理者</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {users.filter(u => u.role === 'org_admin').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-medium text-gray-500">週間アクティブ</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {users.filter(u => {
              if (!u.lastActive) return false
              return (Date.now() - new Date(u.lastActive).getTime()) < 7 * 86_400_000
            }).length}
          </p>
        </div>
      </div>

      {/* 検索 + フィルタ */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="メールアドレスで検索…"
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg
                       bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
        >
          <option value="all">全ロール</option>
          <option value="super_admin">スーパー管理者</option>
          <option value="org_admin">会社管理者</option>
          <option value="member">メンバー</option>
        </select>
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <span className="inline-block w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 mt-2">読み込み中…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-2xl mb-2">👤</p>
          <p className="text-sm text-gray-400">該当ユーザーがいません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">ユーザー</th>
                <th className="text-left px-5 py-3">ロール</th>
                {isSuperAdmin && <th className="text-left px-5 py-3">会社</th>}
                <th className="text-right px-5 py-3">セッション</th>
                <th className="text-right px-5 py-3">最終利用</th>
                <th className="text-right px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => {
                const isMe       = u.email === ctx.email
                const isUpdating = updating === u.id
                const roleOpts   = availableRoles(u.role)

                return (
                  <tr key={u.id} className={`hover:bg-gray-50/50 transition-colors ${isMe ? 'bg-blue-50/20' : ''}`}>

                    {/* メール + 登録日 */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900
                                        flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {u.email[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                            {u.email}
                            {isMe && <span className="ml-1.5 text-[10px] text-blue-500 font-normal">（自分）</span>}
                          </p>
                          <p className="text-xs text-gray-400">{fmtJoined(u.createdAt)} 登録</p>
                        </div>
                      </div>
                    </td>

                    {/* ロール */}
                    <td className="px-5 py-3.5">
                      {roleOpts.length > 1 && !isMe ? (
                        <select
                          value={u.role}
                          onChange={e => changeRole(u.id, e.target.value)}
                          disabled={isUpdating}
                          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5
                                     focus:outline-none focus:ring-2 focus:ring-gray-900/10
                                     bg-white disabled:opacity-60 cursor-pointer"
                        >
                          {roleOpts.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                          ))}
                        </select>
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </td>

                    {/* 会社（super_admin のみ）*/}
                    {isSuperAdmin && (
                      <td className="px-5 py-3.5">
                        <select
                          value={u.orgId ?? ''}
                          onChange={e => changeOrg(u.id, e.target.value || null)}
                          disabled={isUpdating || u.role === 'super_admin'}
                          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5
                                     focus:outline-none focus:ring-2 focus:ring-gray-900/10
                                     bg-white disabled:opacity-50 max-w-[140px] truncate cursor-pointer"
                        >
                          <option value="">— 未所属 —</option>
                          {ctx.orgs.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </td>
                    )}

                    {/* セッション数 */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-mono text-gray-700">
                        {u.sessionCount > 0 ? u.sessionCount : '—'}
                      </span>
                    </td>

                    {/* 最終利用 */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(u.lastActive)}
                      </span>
                    </td>

                    {/* アクション */}
                    <td className="px-5 py-3.5 text-right">
                      {!isMe && u.orgId && (
                        <button
                          onClick={() => removeFromOrg(u.id, u.email)}
                          disabled={isUpdating}
                          className="text-xs text-gray-400 hover:text-red-500
                                     px-2.5 py-1.5 rounded-lg hover:bg-red-50
                                     transition-colors disabled:opacity-40"
                        >
                          {isUpdating
                            ? <span className="inline-block w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                            : '除外'
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-5 py-2.5">
            <p className="text-xs text-gray-400">{filtered.length} / {users.length} 件</p>
          </div>
        </div>
      )}
    </div>
  )
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
    <div className="space-y-5">
      {/* 期間セレクター */}
      <div className="flex gap-1">
        {(Object.keys(RANGE_LABELS) as UsageRange[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${range === r
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">読み込み中…</p>
        </div>
      ) : stats.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">データがありません</p>
        </div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-500">総セッション数</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalSessions.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-500">総質問数</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalMsgs.toLocaleString()}</p>
            </div>
          </div>

          {/* 会社別テーブル */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">会社名</th>
                  <th className="text-right px-5 py-3">セッション</th>
                  <th className="text-right px-5 py-3">質問数</th>
                  <th className="text-right px-5 py-3">最終利用</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.plan}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-gray-700">{s.sessionCount}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-gray-700">{s.msgCount}</td>
                    <td className="px-5 py-3.5 text-right text-xs text-gray-500">{fmtDate(s.lastActive)}</td>
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
  const [name,    setName]    = useState('')
  const [slug,    setSlug]    = useState('')
  const [plan,    setPlan]    = useState('trial')
  const [loading, setLoading] = useState(false)
  const [errMsg,  setErrMsg]  = useState('')

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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">登録済み会社</h3>
        </div>
        {orgs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-400">まだ会社が登録されていません</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">会社名</th>
                <th className="text-left px-5 py-3">slug</th>
                <th className="text-left px-5 py-3">プラン</th>
                <th className="text-right px-5 py-3">ユーザー</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orgs.map(org => (
                <tr key={org.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {org.name}
                    {!org.is_active && (
                      <span className="ml-2 text-xs text-red-500">停止中</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{org.slug}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                      ${org.plan === 'pro'   ? 'bg-purple-100 text-purple-700' :
                        org.plan === 'basic' ? 'bg-blue-100 text-blue-700' :
                                               'bg-gray-100 text-gray-600'}`}>
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-600">{org.userCount}人</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 会社作成フォーム */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">会社を追加</h3>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">会社名</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setSlug(autoSlug(e.target.value)) }}
              placeholder="株式会社〇〇"
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              slug <span className="text-gray-400 font-normal">（半角英小文字・数字・ハイフン）</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="example-company"
              required
              pattern="[a-z0-9-]+"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-mono
                         focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">プラン</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
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
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white
                       hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '作成中…' : '会社を作成'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── 会社セレクター（共通）────────────────────────────────────
function OrgSelector({ orgs, value, onChange }: {
  orgs: Org[]; value: string; onChange: (id: string) => void
}) {
  if (orgs.length === 0) {
    return (
      <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2.5">
        ⚠ 先に「会社管理」から会社を作成してください
      </p>
    )
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">招待先の会社</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
      >
        <option value="">会社を選択…</option>
        {orgs.map(o => (
          <option key={o.id} value={o.id}>{o.name}（{o.plan}）</option>
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

    const { ok, status, data } = await callInviteApi({ email: email.trim(), action: 'link', orgId })
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
    <div className="max-w-xl space-y-5">
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm text-gray-500">
            メールアドレスを入力してリンクを生成し、LINE・チャット等で手動共有してください。
          </p>
        </div>
        <form onSubmit={handleGenerate} className="p-5 space-y-4">
          {ctx.role === 'super_admin' && (
            <OrgSelector orgs={ctx.orgs} value={orgId} onChange={setOrgId} />
          )}
          {ctx.role === 'org_admin' && ctx.orgs.length > 0 && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5">
              招待先: <span className="font-medium">{ctx.orgs[0]?.name}</span>（自社固定）
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">メールアドレス</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="customer@example.com"
                required
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              <button
                type="submit"
                disabled={loading || !email.trim() || (ctx.role === 'super_admin' && !orgId)}
                className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white
                           hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors whitespace-nowrap"
              >
                {loading ? '生成中…' : 'リンクを生成'}
              </button>
            </div>
          </div>
          {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}
        </form>
      </div>

      {link && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <label className="block text-xs font-medium text-gray-600">生成されたリンク</label>
          <div className="flex gap-2 items-start">
            <textarea
              readOnly value={link} rows={3}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2
                         text-xs text-gray-700 resize-none focus:outline-none"
            />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(link)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
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
      const { ok, status, data } = await callInviteApi({ email, action: 'register', orgId, password })
      const result: BulkResult = ok
        ? { email, status: 'ok',      message: '登録しました' }
        : status === 409
          ? { email, status: 'already', message: 'すでに登録済み' }
          : { email, status: 'error',   message: data.error ?? 'エラー' }
      setResults(prev => [...prev, result])
    }
    setLoading(false)
  }

  const emails       = parseEmails(text)
  const okCount      = results.filter(r => r.status === 'ok').length
  const alreadyCount = results.filter(r => r.status === 'already').length
  const errCount     = results.filter(r => r.status === 'error').length

  return (
    <div className="max-w-xl space-y-5">
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm text-gray-500">
            メールアドレスを改行・カンマ区切りで貼り付けて一括登録します。
          </p>
        </div>
        <form onSubmit={handleBulk} className="p-5 space-y-4">
          {ctx.role === 'super_admin' && (
            <OrgSelector orgs={ctx.orgs} value={orgId} onChange={setOrgId} />
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">メールアドレス一覧</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"aaa@example.com\nbbb@example.com"}
              rows={5}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-y font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              初期パスワード <span className="text-gray-400 font-normal">（全ユーザー共通）</span>
            </label>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="例: Welcome2024"
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <div className="flex gap-2 items-center">
            {!loading ? (
              <button
                type="submit"
                disabled={emails.length === 0 || !password || (ctx.role === 'super_admin' && !orgId)}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white
                           hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {emails.length > 0 ? `${emails.length}件を一括登録` : '一括登録'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { abortRef.current = true }}
                className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white
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
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex gap-4 text-sm">
            {okCount      > 0 && <span className="text-green-600">✅ 登録 {okCount}件</span>}
            {alreadyCount > 0 && <span className="text-yellow-600">⚠️ 既存 {alreadyCount}件</span>}
            {errCount     > 0 && <span className="text-red-500">❌ エラー {errCount}件</span>}
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">メールアドレス</th>
                <th className="text-left px-5 py-3">結果</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{r.email}</td>
                  <td className="px-5 py-3">
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
      )}
    </div>
  )
}

// ─── ページ設定 ────────────────────────────────────────────────
const PAGE_META: Record<Tab, { title: string; desc: string }> = {
  users: { title: 'ユーザー管理',   desc: 'メンバーのロール変更・会社移動・除外' },
  orgs:  { title: '会社管理',       desc: '登録済み会社の管理と新規作成' },
  usage: { title: '使用量',         desc: '会社別のAI利用状況' },
  link:  { title: '招待リンク',     desc: 'メールアドレスに招待リンクを発行' },
  bulk:  { title: '一括登録',       desc: 'リストからまとめてユーザーを登録' },
}

// ─── メインページ ──────────────────────────────────────────────
export default function AdminInvitePage() {
  const router   = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [ctx,     setCtx]     = useState<AdminCtx | null>(null)
  const [tab,     setTab]     = useState<Tab>('users')
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState(false)

  useEffect(() => {
    fetchAdminCtx().then(result => {
      if (!result) {
        setDenied(true)
      } else {
        setCtx(result)
        setTab('users')
      }
      setLoading(false)
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleOrgCreated(org: Org) {
    setCtx(prev => prev ? { ...prev, orgs: [org, ...prev.orgs] } : prev)
  }

  // ── ローディング ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="inline-block w-6 h-6 border-2 border-white/30 border-t-white
                           rounded-full animate-spin" />
          <p className="text-sm text-gray-400">読み込み中…</p>
        </div>
      </div>
    )
  }

  // ── アクセス拒否 ──────────────────────────────────────────────
  if (denied || !ctx) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-4xl">🔒</p>
          <p className="text-sm text-red-400 font-medium">アクセス権限がありません</p>
          <a href="/chat" className="text-xs text-blue-400 hover:underline">
            チャットに戻る
          </a>
        </div>
      </div>
    )
  }

  // ── ナビ項目 ──────────────────────────────────────────────────
  type NavItem = { key: Tab; label: string; icon: React.ReactNode }
  const navItems: NavItem[] = [
    { key: 'users', label: 'ユーザー管理', icon: <IconUsers /> },
    ...(ctx.role === 'super_admin'
      ? [{ key: 'orgs' as Tab, label: '会社管理', icon: <IconBuilding /> }]
      : []),
    { key: 'usage', label: '使用量',       icon: <IconChart /> },
    { key: 'link',  label: '招待リンク',   icon: <IconLink /> },
    { key: 'bulk',  label: '一括登録',     icon: <IconClipboard /> },
  ]

  const { title, desc } = PAGE_META[tab]

  return (
    <div className="h-screen flex overflow-hidden">

      {/* ════════════════════════════════════════════════════════
          サイドバー（ChatGPT admin スタイル・ダーク）
          ════════════════════════════════════════════════════════ */}
      <aside className="w-60 bg-gray-900 flex flex-col shrink-0 overflow-y-auto">

        {/* ロゴ */}
        <div className="px-4 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-white">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">sumiirai</p>
              <p className="text-[10px] text-gray-500 leading-tight">Admin Console</p>
            </div>
          </div>
        </div>

        {/* 区切り */}
        <div className="mx-3 border-t border-gray-700/60 mb-2" />

        {/* ナビゲーション */}
        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                          transition-colors text-left select-none
                ${tab === item.key
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ユーザー情報 + アクション */}
        <div className="px-2 py-3">
          <div className="mx-1 border-t border-gray-700/60 mb-2" />

          {/* ユーザー情報 */}
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-gray-300 truncate font-medium">{ctx.email}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {ctx.role === 'super_admin' ? '👑 スーパー管理者' : `🏢 ${ctx.orgName ?? '会社管理者'}`}
            </p>
          </div>

          {/* チャットに戻る */}
          <button
            onClick={() => router.push('/chat')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                       text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
          >
            <IconArrowLeft />
            <span>チャットに戻る</span>
          </button>

          {/* ログアウト */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                       text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors"
          >
            <IconLogout />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════
          メインコンテンツ
          ════════════════════════════════════════════════════════ */}
      <main className="flex-1 bg-gray-50 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">

          {/* ページヘッダー */}
          <div className="mb-7">
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
          </div>

          {/* コンテンツ */}
          {tab === 'users' && <UsersTab ctx={ctx} />}
          {tab === 'orgs'  && ctx.role === 'super_admin' && (
            <OrgsTab orgs={ctx.orgs} onCreated={handleOrgCreated} />
          )}
          {tab === 'link'  && <LinkTab ctx={ctx} />}
          {tab === 'bulk'  && <BulkTab ctx={ctx} />}
          {tab === 'usage' && <UsageTab />}

          {/* フッター */}
          <p className="text-xs text-gray-400 text-center pt-10 pb-4">
            登録済みユーザーは{' '}
            <a href="https://sumiirai.vercel.app/login"
               className="underline hover:text-gray-600"
               target="_blank" rel="noopener noreferrer">
              sumiirai.vercel.app/login
            </a>
            {' '}からログインできます。
          </p>
        </div>
      </main>
    </div>
  )
}

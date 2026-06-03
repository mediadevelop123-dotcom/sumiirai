'use client'

/**
 * app/subsidies/page.tsx  — 補助金RAG デモページ
 *
 * 配置先: src/app/subsidies/page.tsx
 * アクセス: /subsidies
 */

import { useState, useRef } from 'react'

// ─── 型定義 ──────────────────────────────────────────────────

interface Subsidy {
  id: string
  title: string
  catch_phrase?: string | null
  target?: string | null
  max_amount?: number | null
  subsidy_rate?: string | null
  prefecture?: string | null
  deadline?: string | null
  url: string
  similarity: number
}

// ─── コンポーネント ───────────────────────────────────────────

export default function SubsidyRAGPage() {
  const [question, setQuestion]     = useState('')
  const [prefecture, setPrefecture] = useState('')
  const [sources, setSources]       = useState<Subsidy[]>([])
  const [answer, setAnswer]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const answerRef = useRef('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return

    setLoading(true)
    setAnswer('')
    setSources([])
    setError('')
    answerRef.current = ''

    try {
      const res = await fetch('/api/v1/subsidies/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, prefecture: prefecture || null }),
      })

      if (!res.ok || !res.body) throw new Error('通信エラーが発生しました')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) continue
          if (!line.startsWith('data: ')) continue

          const json = JSON.parse(line.slice(6))

          if ('sources' in (json as object) || Array.isArray(json)) {
            setSources(json as Subsidy[])
          } else if (json.text) {
            answerRef.current += json.text
            setAnswer(answerRef.current)
          } else if (json.message && json.message.startsWith('DB_') || json.message?.startsWith('VAL_')) {
            setError(json.message)
          }
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">補助金検索 AI</h1>
          <p className="text-sm text-gray-500 mt-1">
            質問を入力すると、AIが最適な補助金を提案します。（β版 / 参考情報）
          </p>
        </div>

        {/* 検索フォーム */}
        <form onSubmit={handleSearch} className="space-y-3">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="例: 飲食店の設備を新しくしたいのですが、使える補助金はありますか？"
            rows={3}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <div className="flex gap-3">
            <select
              value={prefecture}
              onChange={e => setPrefecture(e.target.value)}
              className="rounded-lg border border-gray-300 p-2 text-sm"
              disabled={loading}
            >
              <option value="">全国</option>
              {PREFECTURES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '検索中...' : '補助金を探す'}
            </button>
          </div>
        </form>

        {/* エラー */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* AI 回答 */}
        {(answer || loading) && (
          <div className="rounded-lg bg-white border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">AI の回答</h2>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {answer}
              {loading && <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5" />}
            </p>
          </div>
        )}

        {/* 検索された補助金カード */}
        {sources.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              検索された補助金（類似度順）
            </h2>
            <div className="space-y-3">
              {sources.map(s => (
                <SubsidyCard key={s.id} subsidy={s} />
              ))}
            </div>
          </div>
        )}

        {/* β版注記 */}
        <p className="text-xs text-gray-400 text-center">
          β版のため情報は参考程度にご利用ください。最新情報は各補助金の公式ページでご確認ください。
        </p>
      </div>
    </main>
  )
}

// ─── 補助金カード ─────────────────────────────────────────────

function SubsidyCard({ subsidy: s }: { subsidy: Subsidy }) {
  const similarityPct = Math.round(s.similarity * 100)

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex-1">{s.title}</h3>
        <span className="shrink-0 text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
          関連度 {similarityPct}%
        </span>
      </div>

      {s.catch_phrase && (
        <p className="text-xs text-gray-600 mt-1">{s.catch_phrase}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {s.max_amount && (
          <span>💰 最大 {s.max_amount.toLocaleString()}円</span>
        )}
        {s.subsidy_rate && (
          <span>📊 補助率 {s.subsidy_rate}</span>
        )}
        {s.prefecture && (
          <span>📍 {s.prefecture}</span>
        )}
        {s.deadline && (
          <span>⏰ 締切 {new Date(s.deadline).toLocaleDateString('ja-JP')}</span>
        )}
      </div>

      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-blue-600 hover:underline"
      >
        詳細を見る →
      </a>
    </div>
  )
}

// ─── 都道府県リスト ───────────────────────────────────────────

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
]

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '補助金相談 AI | aizoo',
  description: '中小企業・個人事業主向け補助金相談 AI サービス（β版）',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  )
}

import { redirect } from 'next/navigation'

// ルートアクセス → /chat にリダイレクト
// (ミドルウェアが未ログインなら /login に飛ばす)
export default function Home() {
  redirect('/chat')
}

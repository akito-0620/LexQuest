import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LexQuest — 語彙図鑑RPG",
  description:
    "英語で自由に話して、自分の言葉が育つ図鑑を作ろう。使った言葉がレベルアップし、まだ使っていない言葉に出会える。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600&family=Noto+Serif+JP:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 md:px-8 md:py-10">
          <header className="flex items-center justify-between pb-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-900 font-serif text-lg font-bold text-parchment-50">
                L
              </span>
              <span className="heading-serif text-2xl font-semibold tracking-wide">
                LexQuest
              </span>
            </Link>
            <nav className="flex items-center gap-1 md:gap-2">
              <Link href="/" className="btn-ghost">
                ホーム
              </Link>
              <Link href="/scenarios" className="btn-ghost">
                シナリオ
              </Link>
              <Link href="/codex" className="btn-ghost">
                図鑑
              </Link>
              <Link href="/settings" className="btn-ghost">
                設定
              </Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="pt-10 text-xs text-ink-500">
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-parchment-200 pt-6">
              <span className="font-serif italic">自由に話そう。話した言葉が、あなたの図鑑になる。</span>
              <span>LexQuest · MVP</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

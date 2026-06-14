# LexQuest

自由に話した英語が「語彙図鑑」として育っていく、RPG型英会話学習Webアプリ。

---

## 概要

AIと自由にテキスト英会話をするだけで、使った単語・熟語・フレーズ・会話機能表現が自動で「語彙図鑑」に蓄積される。経験値・レベルアップ・クエストというRPG的な仕組みを通じて、自分の語彙の成長と偏りを可視化する。

**暗記アプリではなく、「話す」ことを中心に設計している。**

---

## 主な機能

- **AIチャット** — シナリオを選んでAIと自由入力で英会話
- **語彙図鑑（Codex）** — 発話から単語・熟語・フレーズ・会話機能表現を自動抽出・登録
- **XP / レベルシステム** — 新規表現・多様性・クエスト達成でXP獲得。Lv1〜5で成長
- **クエスト** — 「質問を1回返す」「別の言い方を使う」など自然な会話行動を促す小目標
- **リザルト画面** — セッション後に新規表現・レベルアップ・使いすぎ表現・次回おすすめを表示
- **音声入出力（STT/TTS）** — マイク入力と音声読み上げに対応
- **アンケート** — セッション後に5項目の主観評価を収集

---

## 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | Next.js 14 / React 18 / TypeScript |
| スタイリング | Tailwind CSS |
| バックエンド | Next.js Route Handlers |
| ORM / DB | Prisma + SQLite |
| AI | Claude API |

---

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数を設定
cp .env.example .env
# .env に ANTHROPIC_API_KEY と DATABASE_URL を記入

# DBセットアップ
npm run db:setup

# 開発サーバー起動
npm run dev
```

`.env` に必要な変数：

```
DATABASE_URL="file:./prisma/dev.db"
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## 画面構成

```
/              ホーム（プレイヤーレベル・クエスト・最近の表現）
/scenarios     シナリオ選択
/chat/:id      AIとの英会話画面
/result/:id    セッション後リザルト
/codex         語彙図鑑一覧
/settings      設定
```

---

## 語彙の分類

図鑑に登録される表現は4カテゴリで管理される。

| カテゴリ | 例 |
|----------|----|
| Word | friend, study, enjoy |
| Expression | be into, look for, come from |
| Phrase | nice to meet you, what about you |
| Conversation Function | 相槌・質問返し・話題展開・同意など |

---

## ライセンス

MIT

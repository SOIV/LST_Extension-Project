# Live Stream Translator (LST) Project

YouTube向けのコミュニティ字幕プラットフォーム、Chrome拡張機能、Desktop補助アプリのプロジェクトです。

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen.svg)](https://lst-pj.soiv-studio.xyz)
[![Crowdin](https://badges.crowdin.net/lst-project/localized.svg)](https://crowdin.com/project/lst-project)

**言語 / Language / 언어:** [한국어](README.md) | [English](README.en.md) | 日本語

## 概要

LSTは、YouTube動画やライブ配信でコミュニティ字幕、リアルタイムSTT、翻訳字幕を扱うためのプロジェクトです。

現在の中心機能は次の2つです。

- **コミュニティ字幕プラットフォーム**: 動画またはチャンネル単位で字幕をアップロード、編集、検索、管理するWebプラットフォーム
- **Chrome拡張機能**: YouTube上にLSTコミュニティ字幕を独自オーバーレイで表示する拡張機能

また、ブラウザ拡張機能だけでは安定して扱いにくいSTT、オーディオキャプチャ、高度なAI翻訳機能は、**Lite Helper / Desktop App** 側へ分離する方針です。

プラットフォーム: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)

## 現在の状態

| 領域 | 状態 | メモ |
|---|---|---|
| コミュニティ字幕プラットフォーム | 進行中 | ログイン、アップロード、検索、エディタ、クリエイター承認フロー |
| Chrome拡張機能 | 開発版 | YouTubeコミュニティ字幕の読み込みと独自オーバーレイ表示 |
| リアルタイムSTT | 設計/計画 | 拡張機能単体STTとDesktop補助STTを分離 |
| Lite Helper | 計画 | ブラウザ制限を補う軽量Desktop補助アプリ |
| Full Desktop App | 計画 | 高度なSTT、オーディオキャプチャ、AI翻訳、ローカルLLM/Ollama候補 |
| 公開Docsサイト | 計画 | ユーザー/開発者向けDocsサイトは未作成 |

## 主な機能

### コミュニティ字幕プラットフォーム

- Google OAuthによるサインイン
- プロフィールとハンドル管理
- YouTube URLによる字幕アップロード
- SRT、VTT、SMI/SAMI、TTML系字幕の処理
- 動画別字幕一覧と検索
- Web字幕エディタ
- YouTubeプレイヤー連携プレビュー
- リビジョンベースの字幕管理
- クリエイターチャンネル連携、ダッシュボード、承認待ちフロー
- Supabaseによる認証/DBとCloudflare R2によるファイル保存

### Chrome拡張機能

- Chrome Extension Manifest V3
- YouTube動画ページでのコミュニティ字幕検索
- YouTube標準字幕レンダラーに依存しない独自オーバーレイレンダラー
- 字幕位置、サイズ、色、表示方式の設定
- YouTube SPAページ遷移の検知
- ポップアップUIとプレイヤーパネルUI
- 韓国語、英語、日本語ロケール
- 今後、リアルタイムSTTと翻訳字幕機能を拡張予定

### STTと翻訳の方向性

LSTでは、STT/翻訳機能を実行環境ごとに明確に分けます。下の表は現在のリリース状態ではなく、想定する配置方針です。

| 機能 | Extension単体 | Lite Helper | Full Desktop App |
|---|---:|---:|---:|
| コミュニティ字幕表示 | 利用可能 | 不要 | 不要 |
| Web Speech STT | 可能 | 任意 | 任意 |
| Whisper/OpenAI API STT | 可能 | 可能 | 可能 |
| システムオーディオキャプチャ | 制限あり | 可能 | 可能 |
| 高度なAI翻訳プリセット | 制限あり | 一部可能 | 推奨 |
| Ollama/ローカルLLM連携 | 不向き | 制限あり | 推奨 |

拡張機能は軽量で即時利用できる機能を担当します。低遅延の音声キャプチャ、重い処理、カスタムプリセット、ローカルAIランタイムが必要な機能はDesktop側へ分離します。

## プロジェクト構成

```text
LST_Extension-Project/
├── All-Extension_App/
│   └── Chrome_Extension/          # Chrome拡張機能
│       ├── manifest.json
│       ├── popup.html
│       ├── scripts/community/     # コミュニティ字幕ローダー/パーサー/レンダラー
│       ├── scripts/stt/           # STT実験/候補コード
│       ├── styles/
│       └── _locales/              # ko / en / ja
├── platform/                      # Next.jsコミュニティ字幕プラットフォーム
│   └── src/app/
│       ├── [locale]/              # 多言語ページルート
│       ├── api/                   # 字幕、アップロード、クリエイター、状態API
│       ├── auth/
│       ├── subtitles/
│       └── upload/
├── Desktop_App/                   # Desktop/Lite Helper作業領域
└── docs/
    └── LST-PJ_V3/
        ├── public/                # 公開可能な文書
        ├── planning/              # 計画/ドラフト文書
        ├── 99_archive/            # アーカイブ文書
        ├── INDEX.md
        └── _classification.md
```

事業/運用など誤解を招きやすいドラフトは `docs/LST-PJ_V3/sensitive-draft/` に置き、このフォルダは `.gitignore` で除外します。

## 技術スタック

### プラットフォーム

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 16 App Router |
| UI | React 19, Tailwind CSS |
| 言語 | TypeScript |
| i18n | next-intl |
| 認証 | Supabase Auth, Google OAuth |
| データベース | Supabase PostgreSQL, RLS |
| ファイル保存 | Cloudflare R2, S3 compatible API |
| デプロイ | Vercel |

### 拡張機能

| カテゴリ | 技術 |
|---|---|
| 拡張API | Chrome Extension Manifest V3 |
| 対象プラットフォーム | YouTube / YouTube Live中心 |
| 字幕処理 | 独自SRT/VTT/SMI系パーサー |
| レンダリング | DOMオーバーレイ、requestAnimationFrame同期 |
| 設定保存 | chrome.storage.sync |
| ロケール | Chrome `_locales` |

## 開発実行

### プラットフォーム

```bash
cd platform
npm install
npm run dev
```

プラットフォームの実行にはSupabase、Cloudflare R2、YouTube APIなどの環境変数が必要です。ローカル開発では `platform/.env.local` を設定してください。

### Chrome拡張機能

Chromeウェブストア配布前は、開発者モードでインストールします。

1. Chromeで `chrome://extensions` を開く
2. **デベロッパーモード** を有効化
3. **パッケージ化されていない拡張機能を読み込む** を選択
4. `All-Extension_App/Chrome_Extension` を選択

## ドキュメント

現在の文書は `docs/LST-PJ_V3` で管理し、公開可能な文書と計画ドラフトを分離しています。

- 文書インデックス: [docs/LST-PJ_V3/INDEX.md](docs/LST-PJ_V3/INDEX.md)
- 公開レベル分類: [docs/LST-PJ_V3/_classification.md](docs/LST-PJ_V3/_classification.md)
- 公開文書: `docs/LST-PJ_V3/public/`
- 計画文書: `docs/LST-PJ_V3/planning/`

将来的にユーザー/開発者向けDocsサイトを追加する可能性があります。Docsサイトには、計画文書や機密ドラフトではなく、公開向けに再整理した内容だけを含める方針です。

## コントリビュート

バグ報告、機能提案、字幕投稿、文書改善を歓迎します。

```bash
git clone https://github.com/SOIV/LST_Extension-Project.git
cd LST_Extension-Project
git checkout -b feature/your-feature
git commit -m "feat: describe your change"
git push origin feature/your-feature
```

## ライセンス

GPL-3.0 License。詳細は [LICENSE](LICENSE) を確認してください。

YouTubeはGoogle LLCの商標です。LST ProjectはYouTubeまたはGoogle LLCと公式な関係はありません。

## お問い合わせ

- プラットフォーム: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)
- GitHub Issues: [issues](https://github.com/SOIV/LST_Extension-Project/issues)
- Discord: [discord.gg/tVnhbaB9yY](https://discord.gg/tVnhbaB9yY)
- Email: biz@soiv-studio.xyz

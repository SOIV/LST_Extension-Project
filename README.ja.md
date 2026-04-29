# Live Stream Translator (LST) Project

ライブストリーミング向けコミュニティ字幕プラットフォーム + Chrome拡張機能

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen.svg)](https://lst-pj.soiv-studio.xyz)
[![Crowdin](https://badges.crowdin.net/lst-project/localized.svg)](https://crowdin.com/project/lst-project)

**言語 / Language / 언어:** [한국어](README.md) | [English](README.en.md) | 日本語

---

## 📖 概要

LSTは、YouTubeなどのストリーミングプラットフォームにおける言語の壁を取り除くためのプロジェクトです。

- **コミュニティ字幕プラットフォーム** — 誰でも字幕をアップロード・編集でき、クリエイターが承認すると拡張機能で自動表示されます。
- **Chrome拡張機能** — YouTubeの動画にコミュニティ字幕をオーバーレイ表示します。（リアルタイムSTT翻訳は今後対応予定）

> プラットフォーム: **[lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)**

---

## ✨ 主な機能

### コミュニティ字幕プラットフォーム
- Googleアカウントでサインイン
- YouTube URLで字幕をアップロード（SRT / VTT形式）
- Webベースの字幕エディタ（タイムラインビュー / スクリプトビュー）
- YouTubeプレイヤー連携 — キューをクリックして該当時間にシーク
- リビジョン履歴（バージョン管理）

### Chrome拡張機能
- YouTube視聴時にコミュニティ字幕を自動ロード
- 字幕の位置・サイズ・色をカスタマイズ
- SPAナビゲーション対応（YouTubeのページ内遷移をサポート）

### 対応プラットフォーム
| プラットフォーム | コミュニティ字幕 | リアルタイムSTT |
|---|---|---|
| YouTube / YouTube Live | ✅ | 🔜 予定 |
| Twitch | 🔜 予定 | 🔜 予定 |
| ニコニコ動画 | 🔜 予定 | 🔜 予定 |
| SOOP / Chzzk | 🔜 予定 | 🔜 予定 |

---

## 📂 プロジェクト構成

```
LST_Extension-Project/
├── All-Extension_App/
│   └── Chrome_Extension/    # Chrome拡張機能 (Manifest V3)
│       ├── manifest.json
│       ├── popup.html
│       ├── scripts/         # 字幕パーサー・レンダラー・ローダー
│       ├── styles/
│       └── _locales/        # 한국어 / English
├── platform/                # コミュニティ字幕プラットフォーム (Next.js)
│   └── src/app/
│       ├── api/             # REST API（字幕取得・アップロード・リビジョン）
│       ├── subtitles/       # 動画別字幕一覧 + Webエディタ
│       ├── upload/          # 字幕アップロード
│       └── profile/         # プロフィール管理
├── Desktop_App/             # デスクトップアプリ（開発予定）
└── docs/                    # 設計ドキュメント
```

---

## 🛠️ 技術スタック

### プラットフォーム
| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js (App Router) |
| 認証 | Supabase Auth (Google OAuth) |
| データベース | Supabase (PostgreSQL + RLS) |
| ファイルストレージ | Cloudflare R2 |
| デプロイ | Vercel |
| スタイル | Tailwind CSS |

### 拡張機能
| カテゴリ | 技術 |
|---|---|
| API | Chrome Extension Manifest V3 |
| 字幕パース | 独自 SRT / VTT パーサー |
| レンダリング | requestAnimationFrameベースのオーバーレイ |
| 設定保存 | chrome.storage.sync |

---

## 🚀 拡張機能のインストール（開発者モード）

Chromeウェブストアへの公開前は、手動でインストールできます。

1. このリポジトリをクローンまたはZIPでダウンロード
2. Chromeのアドレスバーに `chrome://extensions` と入力
3. 右上の **デベロッパーモード** を有効化
4. **パッケージ化されていない拡張機能を読み込む** をクリック
5. `All-Extension_App/Chrome_Extension` フォルダを選択

> 📅 Chromeウェブストアへの登録は今後を予定しています。

---

## 🤝 コントリビュート

バグ報告、機能提案、字幕の投稿など、どんな貢献も歓迎します。

```bash
# 1. Forkしてクローン
git clone https://github.com/YOUR_USERNAME/LST_Extension-Project.git

# 2. ブランチを作成
git checkout -b feature/your-feature

# 3. 変更をコミット
git commit -m "feat: 変更内容の説明"

# 4. Push & Pull Requestを作成
git push origin feature/your-feature
```

---

## 📜 ライセンス

GPL-3.0 License — 詳細は [LICENSE](LICENSE) ファイルをご確認ください。

---

## 📮 お問い合わせ

- **プラットフォーム**: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)
- **GitHub Issues**: [issues](https://github.com/SOIV/LST_Extension-Project/issues)
- **Discord**: [discord.gg/tVnhbaB9yY](https://discord.gg/tVnhbaB9yY)
- **Email**: biz@soiv-studio.xyz

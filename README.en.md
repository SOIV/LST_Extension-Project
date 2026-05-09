# Live Stream Translator (LST) Project

Community subtitle platform + Chrome extension for live streaming

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen.svg)](https://lst-pj.soiv-studio.xyz)
[![Crowdin](https://badges.crowdin.net/lst-project/localized.svg)](https://crowdin.com/project/lst-project)

**Language / 언어 / 言語:** [한국어](README.md) | English | [日本語](README.ja.md)

---

## 📖 Overview

LST is a project designed to break down language barriers on streaming platforms like YouTube.

- **Community Subtitle Platform** — Anyone can upload and edit subtitles. Once approved by the creator, they appear automatically via the extension.
- **Chrome Extension** — Overlays community subtitles on YouTube videos. (Real-time STT translation coming soon)

> Platform: **[lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)**

---

## ✨ Features

### Community Subtitle Platform
- Sign in with Google
- Upload subtitles (SRT / VTT) by YouTube URL
- Web-based subtitle editor with Timeline and Script views
- YouTube player integration — click a cue to seek
- Revision history (version control)

### Chrome Extension
- Automatically loads community subtitles when watching YouTube
- Customizable subtitle position, size, and color
- SPA navigation detection (supports in-page YouTube navigation)

### Platform Support
| Platform | Community Subtitles | Real-time STT |
|---|---|---|
| YouTube / YouTube Live | ✅ | 🔜 Planned |
| Twitch | 🔜 Planned | 🔜 Planned |
| ニコニコ動画 | 🔜 Planned | 🔜 Planned |
| SOOP / Chzzk | 🔜 Planned | 🔜 Planned |

---

## 📂 Project Structure

```
LST_Extension-Project/
├── All-Extension_App/
│   └── Chrome_Extension/    # Chrome extension (Manifest V3)
│       ├── manifest.json
│       ├── popup.html
│       ├── scripts/         # Subtitle parser, renderer, loader
│       ├── styles/
│       └── _locales/        # Korean / English
├── platform/                # Community subtitle platform (Next.js)
│   └── src/app/
│       ├── api/             # REST API (subtitles, upload, revisions)
│       ├── subtitles/       # Video subtitle list + web editor
│       ├── upload/          # Subtitle upload
│       └── profile/         # Profile management
├── Desktop_App/             # Desktop app (planned)
└── docs/                    # Design documents
```

---

## 🛠️ Tech Stack

### Platform
| Category | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase (PostgreSQL + RLS) |
| File Storage | Cloudflare R2 |
| Deployment | Vercel |
| Styling | Tailwind CSS |

### Extension
| Category | Technology |
|---|---|
| API | Chrome Extension Manifest V3 |
| Subtitle Parsing | Custom SRT / VTT parser |
| Rendering | requestAnimationFrame overlay |
| Settings | chrome.storage.sync |

---

## 🚀 Install Extension (Developer Mode)

Until the Chrome Web Store listing is available, install it manually:

1. Clone this repo or download as ZIP
2. Navigate to `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `All-Extension_App/Chrome_Extension` folder

> 📅 Chrome Web Store submission is planned for a future release.

---

## 🤝 Contributing

Bug reports, feature requests, and subtitle contributions are all welcome.

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/LST_Extension-Project.git

# 2. Create a branch
git checkout -b feature/your-feature

# 3. Commit your changes
git commit -m "feat: describe your change"

# 4. Push & open a Pull Request
git push origin feature/your-feature
```

---

## 📜 License

GPL-3.0 License — See the [LICENSE](LICENSE) file for details.<br>
YouTube is a trademark of Google LLC. LST Project is not officially affiliated with YouTube.

---

## 📮 Contact

- **Platform**: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)
- **GitHub Issues**: [issues](https://github.com/SOIV/LST_Extension-Project/issues)
- **Discord**: [discord.gg/tVnhbaB9yY](https://discord.gg/tVnhbaB9yY)
- **Email**: biz@soiv-studio.xyz

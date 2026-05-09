# Live Stream Translator (LST) Project

Community subtitle platform, Chrome extension, and planned desktop helper for YouTube-centered subtitle workflows.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen.svg)](https://lst-pj.soiv-studio.xyz)
[![Crowdin](https://badges.crowdin.net/lst-project/localized.svg)](https://crowdin.com/project/lst-project)

**Language / 언어 / 言語:** [한국어](README.md) | English | [日本語](README.ja.md)

## Overview

LST is a project for community subtitles, real-time STT, and translated subtitles on YouTube videos and live streams.

The current project focus is:

- **Community subtitle platform**: a web platform for uploading, editing, searching, and managing subtitles by video or channel
- **Chrome extension**: a browser extension that displays LST community subtitles on YouTube with its own overlay renderer

The project also plans a **Lite Helper / Desktop App** split for STT, audio capture, and advanced AI translation features that are difficult to run reliably inside a browser extension alone.

Platform: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)

## Status

| Area | Status | Notes |
|---|---|---|
| Community subtitle platform | In progress | Login, upload, search, editor, creator approval flow |
| Chrome extension | Developer build | YouTube community subtitle loading and custom overlay rendering |
| Real-time STT | Design/planned | Split between extension-only STT and desktop-assisted STT |
| Lite Helper | Planned | Lightweight desktop helper for browser limitations |
| Full Desktop App | Planned | Advanced STT, audio capture, AI translation, local LLM/Ollama candidates |
| Public docs site | Planned | User/developer docs site has not been scaffolded yet |

## Features

### Community Subtitle Platform

- Google OAuth sign-in
- Profile and handle management
- Subtitle upload by YouTube URL
- SRT, VTT, SMI/SAMI, and TTML-family subtitle handling
- Video subtitle list and search
- Web subtitle editor
- YouTube player preview integration
- Revision-based subtitle management
- Creator channel connection, dashboard, and pending approval flow
- Supabase-backed auth/database and Cloudflare R2 file storage

### Chrome Extension

- Chrome Extension Manifest V3
- Community subtitle lookup on YouTube video pages
- Custom overlay renderer that does not depend on YouTube's native subtitle renderer
- Subtitle position, size, color, and display settings
- YouTube SPA navigation detection
- Popup UI and in-player panel UI
- Korean, English, and Japanese locales
- Planned expansion for real-time STT and translated subtitles

### STT and Translation Direction

LST separates STT/translation features by runtime boundary. The table below describes the intended placement, not the current release status.

| Feature | Extension only | Lite Helper | Full Desktop App |
|---|---:|---:|---:|
| Community subtitle display | Available | Not needed | Not needed |
| Web Speech STT | Possible | Optional | Optional |
| Whisper/OpenAI API STT | Possible | Possible | Possible |
| System audio capture | Limited | Possible | Possible |
| Advanced AI translation presets | Limited | Partial | Recommended |
| Ollama/local LLM integration | Not suitable | Limited | Recommended |

The extension should stay lightweight and immediately usable. Features that require low-latency audio capture, heavy processing, custom presets, or local AI runtimes are better isolated into the desktop side.

## Project Structure

```text
LST_Extension-Project/
├── All-Extension_App/
│   └── Chrome_Extension/          # Chrome extension
│       ├── manifest.json
│       ├── popup.html
│       ├── scripts/community/     # Community subtitle loader/parser/renderer
│       ├── scripts/stt/           # STT experiments/candidates
│       ├── styles/
│       └── _locales/              # ko / en / ja
├── platform/                      # Next.js community subtitle platform
│   └── src/app/
│       ├── [locale]/              # Localized page routes
│       ├── api/                   # Subtitle, upload, creator, and status APIs
│       ├── auth/
│       ├── subtitles/
│       └── upload/
├── Desktop_App/                   # Desktop/Lite Helper workspace
└── docs/
    └── LST-PJ_V3/
        ├── public/                # Public-safe documents
        ├── planning/              # Planning and draft documents
        ├── 99_archive/            # Archived documents
        ├── INDEX.md
        └── _classification.md
```

Sensitive business or operations drafts are kept under `docs/LST-PJ_V3/sensitive-draft/`, which is excluded by `.gitignore`.

## Tech Stack

### Platform

| Category | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS |
| Language | TypeScript |
| i18n | next-intl |
| Auth | Supabase Auth, Google OAuth |
| Database | Supabase PostgreSQL, RLS |
| File storage | Cloudflare R2, S3 compatible API |
| Deployment | Vercel |

### Extension

| Category | Technology |
|---|---|
| Extension API | Chrome Extension Manifest V3 |
| Target platform | YouTube / YouTube Live first |
| Subtitle handling | Custom SRT/VTT/SMI-family parser |
| Rendering | DOM overlay, requestAnimationFrame synchronization |
| Settings storage | chrome.storage.sync |
| Locales | Chrome `_locales` |

## Development

### Platform

```bash
cd platform
npm install
npm run dev
```

The platform requires environment variables for Supabase, Cloudflare R2, YouTube API, and related services. Configure `platform/.env.local` for local development.

### Chrome Extension

Before Chrome Web Store distribution, install the extension in developer mode.

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `All-Extension_App/Chrome_Extension`

## Documentation

Documents are managed under `docs/LST-PJ_V3` with public-safe documents separated from planning drafts.

- Document index: [docs/LST-PJ_V3/INDEX.md](docs/LST-PJ_V3/INDEX.md)
- Classification policy: [docs/LST-PJ_V3/_classification.md](docs/LST-PJ_V3/_classification.md)
- Public documents: `docs/LST-PJ_V3/public/`
- Planning documents: `docs/LST-PJ_V3/planning/`

A dedicated user/developer docs site may be added later. The docs site should be generated from rewritten public-facing content, not directly from planning or sensitive drafts.

## Contributing

Bug reports, feature requests, subtitle contributions, and documentation improvements are welcome.

```bash
git clone https://github.com/YOUR_USERNAME/LST_Extension-Project.git
cd LST_Extension-Project
git checkout -b feature/your-feature
git commit -m "feat: describe your change"
git push origin feature/your-feature
```

## License

GPL-3.0 License. See [LICENSE](LICENSE) for details.

YouTube is a trademark of Google LLC. LST Project is not officially affiliated with YouTube or Google LLC.

## Contact

- Platform: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)
- GitHub Issues: [issues](https://github.com/SOIV/LST_Extension-Project/issues)
- Discord: [discord.gg/tVnhbaB9yY](https://discord.gg/tVnhbaB9yY)
- Email: biz@soiv-studio.xyz

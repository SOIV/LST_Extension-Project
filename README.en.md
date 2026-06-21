# Live Stream Translator (LST) Project

Community subtitle platform, browser extension, and planned desktop helper for YouTube-centered subtitle workflows.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chromewebstore.google.com/detail/nbjghecapdnggdklamlmebflgajpgeeb?utm_source=item-share-cb)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen.svg)](https://lst-pj.soiv-studio.xyz)
[![Docs](https://img.shields.io/badge/Docs-Live-brightgreen.svg)](https://docs.lst-pj.soiv-studio.xyz)
[![Crowdin](https://badges.crowdin.net/lst-project/localized.svg)](https://crowdin.com/project/lst-project)

**Language / 언어 / 言語:** [한국어](README.md) | English | [日本語](README.ja.md)

## Overview

LST is a project for community subtitles, real-time STT, and translated subtitles on YouTube videos and live streams.

The current project focus is:

- **Community subtitle platform**: a web platform for uploading, editing, searching, and managing subtitles by video or channel
- **Chrome extension**: a browser extension that displays LST community subtitles on YouTube with its own overlay renderer

The project also includes **STT/translation features**, a **Firefox port candidate**, and a planned **Lite Helper / Desktop App** split for STT, audio capture, and advanced AI translation features that are difficult to run reliably inside a browser extension alone.

Platform: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)

## Status

| Area | Status | Notes |
|---|---|---|
| Community subtitle platform | In development | Login, upload, editor, creator channel connection and approval flow complete. Main home, diff view, Scripting View in progress |
| Chrome extension | In development | Community subtitle loading/rendering and realtime STT base paths working. Sync correction and advanced features in progress |
| Firefox extension | Port candidate | Manifest and locale-centered. Actual functionality follows the Chrome extension |
| Real-time STT | Partially available | Whisper API / OpenAI Realtime API paths working. Web Speech API V1 unstable. Server-provided STT not yet implemented |
| Lite Helper | Planned | Lightweight desktop helper to complement browser extension limitations |
| Full Desktop App | Planned | Advanced STT, audio capture, AI translation, local LLM/Ollama candidates |
| Public docs site | In progress | Work underway in `Docs_web/`. User/developer docs site being built |

For full progress details, see the [Roadmap](docs/LST-PJ_V3/planning/00_core/roadmap.md).

## Features

### Community Subtitle Platform

- Google OAuth sign-in
- Profile and handle management
- Subtitle upload by YouTube URL
- SRT and VTT subtitle handling (SMI/SAMI and TTML support planned)
- Video subtitle list and search
- Web subtitle editor
- YouTube player preview integration
- Revision-based subtitle management
- Creator channel connection, dashboard, and pending approval flow
- Supabase-backed auth/database and Cloudflare R2 file storage

### Browser Extension

- Chrome Extension Manifest V3
- Community subtitle lookup on YouTube video pages
- Custom overlay renderer that does not depend on YouTube's native subtitle renderer
- Subtitle position, size, color, and display settings
- YouTube SPA navigation detection
- Popup UI and in-player panel UI
- Korean, English, and Japanese locales
- STT/translation features based on Web Speech, OpenAI Whisper/Realtime, Google Translate, Papago, and DeepL
- Firefox extension port candidate directory included

### STT and Translation Direction

LST separates STT/translation features by runtime boundary. The table below describes the intended placement rather than the completion level of each feature.

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
│   ├── Chrome_Extension/          # Chrome extension
│   │   ├── manifest.json
│   │   ├── popup.html
│   │   ├── scripts/community/     # Community subtitle loader/parser/renderer
│   │   ├── scripts/stt/           # STT/translation feature code
│   │   ├── styles/
│   │   └── _locales/              # ko / en / ja
│   └── Firefox_Extension/         # Firefox port candidate
│       ├── manifest.json
│       └── _locales/
├── platform/                      # Next.js community subtitle platform
│   └── src/app/
│       ├── [locale]/              # Localized page routes
│       ├── api/                   # Subtitle, upload, creator, and status APIs
│       ├── auth/
│       ├── subtitles/
│       └── upload/
├── Desktop_App/                   # Desktop/Lite Helper workspace
├── Docs_web/                      # Future public docs site workspace
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
| Browser STT | Web Speech API |
| API-based STT | OpenAI Audio API, OpenAI Realtime API |
| Translation engines | Google Translate, Papago, DeepL |
| Audio capture | chrome.tabCapture, Offscreen Document |
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

Key environment variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public platform URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Public subtitle file URL |
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `YOUTUBE_API_KEY` | Video/channel metadata lookup |
| `YOUTUBE_CLIENT_ID` | Creator channel OAuth |
| `YOUTUBE_CLIENT_SECRET` | Creator channel OAuth |
| `YOUTUBE_TOKEN_CIPHER_KEY` | YouTube OAuth token encryption |
| `CRON_SECRET` | Internal cron API protection |

Validation commands:

```bash
cd platform
npm run lint
npm run build
```

### Chrome Extension

> We are currently distributing the Beta version to the Chrome Web Store.<br> There may be bugs or errors during this process, and we are accepting reports via GitHub Issues or email.

Before Chrome Web Store distribution, install the extension in developer mode.

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `All-Extension_App/Chrome_Extension`

The Firefox extension is currently a port candidate. Actual development and testing are based on `All-Extension_App/Chrome_Extension`.

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
git clone https://github.com/SOIV/LST_Extension-Project.git
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

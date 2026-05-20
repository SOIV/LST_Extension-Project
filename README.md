# Live Stream Translator (LST) Project

YouTube 중심 커뮤니티 자막 플랫폼 + 브라우저 확장 프로그램 + Desktop 보조 앱 프로젝트

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen.svg)](https://lst-pj.soiv-studio.xyz)
[![Crowdin](https://badges.crowdin.net/lst-project/localized.svg)](https://crowdin.com/project/lst-project)

**언어 / Language / 言語:** 한국어 | [English](README.en.md) | [日本語](README.ja.md)

## 개요

LST는 YouTube 영상과 라이브 방송에서 커뮤니티 자막, 실시간 STT, 번역 자막을 다루기 위한 프로젝트입니다.

현재 중심 기능은 다음 두 가지입니다.

- **커뮤니티 자막 플랫폼**: 사용자가 자막을 업로드하고, 편집하고, 영상/채널 단위로 관리하는 웹 플랫폼
- **Chrome 확장 프로그램**: YouTube 페이지 위에 LST 커뮤니티 자막을 자체 오버레이로 표시하는 확장 프로그램

추가로 **STT/번역 기능**, **Firefox 포팅 후보**, **Lite Helper / Desktop App**을 통해 브라우저 단독으로 처리하기 어려운 STT, 오디오 캡처, 고급 AI 번역 기능을 분리하는 방향으로 설계하고 있습니다.

플랫폼: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)

## 현재 상태

| 영역 | 상태 | 비고 |
|---|---|---|
| 커뮤니티 자막 플랫폼 | 진행 중 | 로그인, 업로드, 검색, 편집기, 크리에이터 승인 흐름 구현 중 |
| Chrome 확장 프로그램 | 개발 버전 | YouTube 커뮤니티 자막 로드, 자체 오버레이 렌더러, STT/번역 기능 포함 |
| Firefox 확장 프로그램 | 초기 포팅 | Manifest와 로케일 중심의 포팅 후보. 실제 기능은 Chrome 확장 프로그램 기준 |
| 실시간 STT | 사용 가능/조정 중 | Extension 단독 Web Speech/API STT와 Desktop 보조 STT를 분리 |
| Lite Helper | 계획 | 브라우저 확장의 한계를 보완하는 경량 Desktop 보조 앱 |
| Full Desktop App | 계획 | 고급 STT, 오디오 캡처, AI 번역, 로컬 LLM/Ollama 연동 후보 |
| 공개 Docs 사이트 | 계획 | `Docs_web/` 작업 영역은 있으나 사용자/개발자용 사이트는 아직 생성 전 |

## 주요 기능

### 커뮤니티 자막 플랫폼

- Google OAuth 기반 로그인
- 프로필/핸들 관리
- YouTube URL 기반 자막 업로드
- SRT, VTT, SMI/SAMI, TTML 계열 자막 처리
- 영상별 자막 목록과 검색
- 웹 자막 편집기
- YouTube 플레이어 연동 미리보기
- 리비전 기반 자막 관리
- 크리에이터 채널 연동, 대시보드, 승인 대기 흐름
- Supabase 기반 인증/DB와 Cloudflare R2 기반 파일 저장

### 브라우저 확장 프로그램

- Manifest V3 기반 Chrome 확장 프로그램
- YouTube 영상 페이지에서 커뮤니티 자막 자동 조회
- 공식 YouTube 자막 렌더러에 의존하지 않는 자체 오버레이 렌더러
- 자막 위치, 크기, 색상, 표시 방식 설정
- YouTube SPA 페이지 이동 감지
- 팝업 UI와 플레이어 패널 UI
- 한국어, 영어, 일본어 로케일
- Web Speech, OpenAI Whisper/Realtime, Google Translate, Papago, DeepL 기반 STT/번역 기능
- Firefox 확장 프로그램 포팅 후보 폴더 포함

### STT와 번역 방향

LST의 STT/번역 기능은 실행 위치를 명확히 분리하는 방향입니다. 아래 표는 개별 기능의 완성도보다 기능 배치 방향을 의미합니다.

| 기능 | Extension 단독 | Lite Helper | Full Desktop App |
|---|---:|---:|---:|
| 커뮤니티 자막 표시 | 가능 | 불필요 | 불필요 |
| Web Speech 기반 STT | 가능 | 선택 | 선택 |
| Whisper/OpenAI API 기반 STT | 가능 | 가능 | 가능 |
| 시스템 오디오 캡처 | 제한적 | 가능 | 가능 |
| 고급 AI 번역 프리셋 | 제한적 | 일부 가능 | 권장 |
| Ollama/로컬 LLM 연동 | 부적합 | 제한적 | 권장 |

확장 프로그램은 가볍고 즉시 사용할 수 있는 기능을 담당하고, 지연/렉/오디오 캡처/고급 AI 설정이 필요한 기능은 Desktop 계열로 분리하는 것을 기본 방향으로 둡니다.

## 프로젝트 구조

```text
LST_Extension-Project/
├── All-Extension_App/
│   ├── Chrome_Extension/          # Chrome 확장 프로그램
│   │   ├── manifest.json
│   │   ├── popup.html
│   │   ├── scripts/community/     # 커뮤니티 자막 로더/파서/렌더러
│   │   ├── scripts/stt/           # STT/번역 기능 코드
│   │   ├── styles/
│   │   └── _locales/              # ko / en / ja
│   └── Firefox_Extension/         # Firefox 포팅 후보
│       ├── manifest.json
│       └── _locales/
├── platform/                      # Next.js 커뮤니티 자막 플랫폼
│   └── src/app/
│       ├── [locale]/              # 다국어 페이지 라우트
│       ├── api/                   # 자막, 업로드, 크리에이터, 상태 API
│       ├── auth/
│       ├── subtitles/
│       └── upload/
├── Desktop_App/                   # Desktop/Lite Helper 계열 작업 영역
├── Docs_web/                      # 향후 공개 문서 사이트 작업 영역
└── docs/
    └── LST-PJ_V3/
        ├── public/                # 공개 가능 문서
        ├── planning/              # 기획/초안 문서
        ├── 99_archive/            # 보관 문서
        ├── INDEX.md
        └── _classification.md
```

민감하거나 오해 가능성이 있는 사업/운영 초안은 `docs/LST-PJ_V3/sensitive-draft/`에 두며, 이 폴더는 `.gitignore`로 제외합니다.

## 기술 스택

### 플랫폼

| 분류 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 App Router |
| UI | React 19, Tailwind CSS |
| 언어 | TypeScript |
| i18n | next-intl |
| 인증 | Supabase Auth, Google OAuth |
| 데이터베이스 | Supabase PostgreSQL, RLS |
| 파일 저장 | Cloudflare R2, S3 compatible API |
| 배포 | Vercel |

### 확장 프로그램

| 분류 | 기술 |
|---|---|
| 확장 API | Chrome Extension Manifest V3 |
| 대상 플랫폼 | YouTube / YouTube Live 중심 |
| 자막 처리 | 자체 SRT/VTT/SMI 계열 파서 |
| 렌더링 | DOM 오버레이, requestAnimationFrame 동기화 |
| 브라우저 STT | Web Speech API |
| API 기반 STT | OpenAI Audio API, OpenAI Realtime API |
| 번역 엔진 | Google Translate, Papago, DeepL |
| 오디오 캡처 | chrome.tabCapture, Offscreen Document |
| 설정 저장 | chrome.storage.sync |
| 로케일 | Chrome `_locales` |

## 개발 실행

### 플랫폼

```bash
cd platform
npm install
npm run dev
```

플랫폼 실행에는 Supabase, Cloudflare R2, YouTube API 등 환경 변수가 필요합니다. 로컬 실행 시 `platform/.env.local`을 구성해야 합니다.

주요 환경 변수:

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | 플랫폼 공개 URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 Supabase service role key. RLS가 켜진 서버 캐시/관리 작업에 사용 |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | 공개 자막 파일 접근 URL |
| `R2_ENDPOINT` | Cloudflare R2 S3 호환 엔드포인트 |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 버킷명 |
| `YOUTUBE_API_KEY` | 영상/채널 메타데이터 조회 |
| `YOUTUBE_CLIENT_ID` | 크리에이터 채널 OAuth |
| `YOUTUBE_CLIENT_SECRET` | 크리에이터 채널 OAuth |
| `YOUTUBE_TOKEN_CIPHER_KEY` | YouTube OAuth 토큰 암호화 |
| `CRON_SECRET` | 내부 cron API 보호 |

검증 명령:

```bash
cd platform
npm run lint
npm run build
```

### Chrome 확장 프로그램

Chrome 웹 스토어 배포 전에는 개발자 모드로 설치합니다.

1. Chrome 주소창에서 `chrome://extensions` 열기
2. 우측 상단 **개발자 모드** 활성화
3. **압축 해제된 확장 프로그램 로드** 선택
4. `All-Extension_App/Chrome_Extension` 폴더 선택

Firefox 확장 프로그램은 현재 포팅 후보 상태입니다. 실제 개발과 테스트는 `All-Extension_App/Chrome_Extension`을 기준으로 진행합니다.

## 문서

현재 문서는 `docs/LST-PJ_V3` 아래에서 공개 가능 문서와 기획 문서를 분리해 관리합니다.

- 문서 인덱스: [docs/LST-PJ_V3/INDEX.md](docs/LST-PJ_V3/INDEX.md)
- 공개 수준 분류: [docs/LST-PJ_V3/_classification.md](docs/LST-PJ_V3/_classification.md)
- 공개 문서: `docs/LST-PJ_V3/public/`
- 기획 문서: `docs/LST-PJ_V3/planning/`

향후 사용자 가이드와 개발자 가이드는 별도 Docs 사이트로 분리할 수 있습니다. Docs 사이트에는 `public` 문서를 기반으로 재작성한 내용만 포함하는 것을 원칙으로 합니다.

## 기여

버그 리포트, 기능 제안, 자막 기여, 문서 개선 모두 가능합니다.

```bash
git clone https://github.com/SOIV/LST_Extension-Project.git
cd LST_Extension-Project
git checkout -b feature/your-feature
git commit -m "feat: describe your change"
git push origin feature/your-feature
```

## 라이선스

GPL-3.0 License. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

YouTube는 Google LLC의 상표입니다. LST Project는 YouTube 또는 Google LLC와 공식적인 관련이 없습니다.

## 문의

- 플랫폼: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)
- GitHub Issues: [issues](https://github.com/SOIV/LST_Extension-Project/issues)
- Discord: [discord.gg/tVnhbaB9yY](https://discord.gg/tVnhbaB9yY)
- Email: biz@soiv-studio.xyz

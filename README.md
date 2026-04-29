# Live Stream Translator (LST) Project

실시간 스트리밍을 위한 커뮤니티 자막 플랫폼 + Chrome 확장 프로그램

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen.svg)](https://lst-pj.soiv-studio.xyz)
[![Crowdin](https://badges.crowdin.net/lst-project/localized.svg)](https://crowdin.com/project/lst-project)

**언어 / Language / 言語:** 한국어 | [English](README.en.md) | [日本語](README.ja.md)

---

## 📖 개요

LST는 YouTube 등 스트리밍 플랫폼의 언어 장벽을 허물기 위한 프로젝트입니다.

- **커뮤니티 자막 플랫폼** — 누구나 자막을 업로드·편집하고, 크리에이터가 승인하면 익스텐션에서 자동으로 표시
- **Chrome 확장 프로그램** — 유튜브 영상에 커뮤니티 자막을 오버레이로 표시 (실시간 STT 번역은 추후 지원 예정)

> 플랫폼 바로가기: **[lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)**

---

## ✨ 주요 기능

### 커뮤니티 자막 플랫폼
- Google 계정으로 로그인
- YouTube URL로 자막 업로드 (SRT / VTT)
- 웹 기반 자막 편집기 (타임라인 뷰 / 스크립트 뷰)
- YouTube 플레이어 연동 — 큐 클릭 시 해당 시간으로 seek
- 리비전 히스토리 (버전 관리)

### Chrome 확장 프로그램
- 유튜브 영상 재생 시 커뮤니티 자막 자동 로드
- 자막 표시 위치·크기·색상 설정
- SPA 네비게이션 감지 (YouTube 내 페이지 이동 지원)

### 지원 플랫폼
| 플랫폼 | 커뮤니티 자막 | 실시간 STT |
|---|---|---|
| YouTube / YouTube Live | ✅ | 🔜 예정 |
| Twitch | 🔜 예정 | 🔜 예정 |
| ニコニコ動画 | 🔜 예정 | 🔜 예정 |
| SOOP / Chzzk | 🔜 예정 | 🔜 예정 |

---

## 📂 프로젝트 구조

```
LST_Extension-Project/
├── All-Extension_App/
│   └── Chrome_Extension/    # Chrome 확장 프로그램 (Manifest V3)
│       ├── manifest.json
│       ├── popup.html
│       ├── scripts/         # 자막 파서·렌더러·로더
│       ├── styles/
│       └── _locales/        # 한국어 / English
├── platform/                # 커뮤니티 자막 플랫폼 (Next.js)
│   └── src/app/
│       ├── api/             # REST API (자막 조회·업로드·리비전)
│       ├── subtitles/       # 영상별 자막 목록 + 웹 편집기
│       ├── upload/          # 자막 업로드
│       └── profile/         # 프로필 관리
├── Desktop_App/             # 데스크탑 앱 (개발 예정)
└── docs/                    # 설계 문서
```

---

## 🛠️ 기술 스택

### 플랫폼
| 분류 | 기술 |
|---|---|
| 프레임워크 | Next.js (App Router) |
| 인증 | Supabase Auth (Google OAuth) |
| 데이터베이스 | Supabase (PostgreSQL + RLS) |
| 파일 스토리지 | Cloudflare R2 |
| 배포 | Vercel |
| 스타일 | Tailwind CSS |

### 확장 프로그램
| 분류 | 기술 |
|---|---|
| API | Chrome Extension Manifest V3 |
| 자막 파싱 | 자체 SRT / VTT 파서 |
| 렌더링 | requestAnimationFrame 기반 오버레이 |
| 설정 저장 | chrome.storage.sync |

---

## 🚀 확장 프로그램 설치 (개발 버전)

Chrome 웹 스토어 등록 전까지 개발자 모드로 설치할 수 있습니다.

1. 이 저장소를 클론하거나 ZIP으로 다운로드
2. Chrome 주소창에 `chrome://extensions` 입력
3. 우측 상단 **개발자 모드** 활성화
4. **압축 해제된 확장 프로그램 로드** 클릭
5. `All-Extension_App/Chrome_Extension` 폴더 선택

> 📅 Chrome 웹 스토어 등록은 추후 진행 예정입니다.

---

## 🤝 기여

버그 리포트, 기능 제안, 자막 기여 모두 환영합니다.

```bash
# 1. Fork 후 클론
git clone https://github.com/YOUR_USERNAME/LST_Extension-Project.git

# 2. 브랜치 생성
git checkout -b feature/your-feature

# 3. 변경 후 커밋
git commit -m "feat: 기능 설명"

# 4. Push & Pull Request
git push origin feature/your-feature
```

---

## 📜 라이선스

GPL-3.0 License — 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 📮 문의

- **플랫폼**: [lst-pj.soiv-studio.xyz](https://lst-pj.soiv-studio.xyz)
- **GitHub Issues**: [issues](https://github.com/SOIV/LST_Extension-Project/issues)
- **Discord**: [discord.gg/tVnhbaB9yY](https://discord.gg/tVnhbaB9yY)
- **Email**: biz@soiv-studio.xyz

# LST 프로젝트 로드맵

> 2026-04-27 확정

---

## 프로젝트 방향

YouTube 영상 및 라이브를 대상으로 한 **커뮤니티 자막 플랫폼 + Chrome Extension**.
다국어 자막을 원하는 크리에이터(버튜버 등)를 주요 타겟으로 하며,
플랫폼 완성 후 크리에이터 채널에 직접 컨택 예정.

---

## 확정 범위

- YouTube 전체 (일반 영상 + 라이브)
- Chrome Extension (자막 표시)
- 커뮤니티 자막 플랫폼 (독립 웹 서비스)
- 실시간 STT 자막 (차후)
- 타 플랫폼 지원 (차후)
- Desktop App / Lite Helper (상황 보고 결정)

---

## 기술 스택

| 역할 | 선택 |
|------|------|
| 웹 플랫폼 | Next.js + TypeScript |
| 호스팅 | Vercel |
| DB + 인증 | Supabase (PostgreSQL + Google OAuth) |
| 스토리지 | Cloudflare R2 |
| 도메인 | Cloudflare |
| Extension | JS/TS |
| 서버 모니터링 | Uptime Kuma |

---

## Extension MVP

**자막 로딩**
- 영상 ID 기반 플랫폼 DB 자막 조회
- YouTube 공식 자막 있으면 바이패스
- 바이패스 안 되면 플랫폼 자막 오버레이 표시
- 여러 언어 자막 시 사용자 설정 언어 우선

**싱크 및 렌더링**
- 영상 로딩 시 자막 빠르게 적용
- 타임스탬프 기반 자동 싱크 조정
- YouTube SPA 네비게이션 감지 (영상 전환 시 재로딩)
- 영상 위 자막 오버레이 렌더링

**UX**
- 자막 있음/없음 표시 (Extension 배지)
- 켜기/끄기 토글
- 언어 선택 설정
- 자막 파일 로컬 캐싱 (선택사항)

**에러 및 모니터링**
- 자막 없는 영상 조용히 처리
- 서버 무응답 시 조용히 실패
- 에러 발생 시 모니터링 채널/서버로 상태 전송
- Uptime Kuma 연동

---

## 플랫폼 MVP

**계정 및 인증**
- Google OAuth 로그인
- 기본 계정 (닉네임, 핸들)

**자막 관리**
- 자막 업로드 (SRT/VTT, videoId 자동 추출)
- 자막 조회 API (Extension 연동용)
- 언어별 필터
- 자막 버전 관리 (리비전, 롤백, 기여자 기록)

**편집기**
- 기본 웹 편집기 (Basic View, 타임라인 기반)
- Scripting View (고급 편집기)
- YouTube IFrame 영상 미리보기

**크리에이터 기능**
- 크리에이터 채널 연동 (YouTube OAuth)
- 승인 전 LST에서만 표시 / 승인 후 공개
- YouTube 자막 직접 업로드 (비상용 - API 문제 대비)

**기타**
- 신고 기능 (기본)

---

## Phase 로드맵

| Phase | 내용 |
|-------|------|
| **Phase 1** | 기반 구축 (프로젝트 세팅, Uptime Kuma) |
| **Phase 2** | Extension MVP |
| **Phase 3** | 플랫폼 MVP 코어 (로그인, 자막 업로드/조회, 편집기, 버전관리) |
| **Phase 4** | 플랫폼 MVP 크리에이터 (채널 연동, 승인 워크플로우, YouTube 업로드) |
| **Phase 5** | 통합 & 안정화 |
| **Phase 6** | 실시간 자막 (Web Speech API) |
| **Phase 7** | 타 플랫폼 지원 (Twitch 등) |
| **Phase 8** | 모더레이터 시스템 *(데이터 쌓인 후)* |
| **Phase 9** | 플랫폼 성장 *(규모 커진 후)* — 신뢰도 점수, 번역 팀, 언어 시험/검수자, AI 자동 검수, 수익화 |

---

*세세한 부분은 개발하면서 추가 예정*

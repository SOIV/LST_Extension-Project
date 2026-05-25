# LST 프로젝트 로드맵

Last updated: 2026-05-26

## 1) 프로젝트 방향

YouTube 영상/라이브를 대상으로 한 **커뮤니티 자막 플랫폼 + Chrome Extension**을 우선 완성한다.

## 2) 확정 범위

- YouTube 전체 (일반 영상 + 라이브)
- Chrome Extension (자막 표시)
- 커뮤니티 자막 플랫폼 (독립 웹 서비스)
- 실시간 STT 자막 (병행 검증 트랙)
- 타 플랫폼 지원 (후속)
- Desktop App / Lite Helper (상황 보고 결정)

## 3) 상태 기준

| 상태 | 의미 |
|---|---|
| `completed` | 기능 구현 + 기본 검증 완료 |
| `in_progress` | 구현 중 (핵심 경로 진행 중) |
| `planned` | 범위 확정, 착수 전 |
| `blocked` | 외부 이슈/의존성으로 정지 |

## 4) 진행 대시보드 (Master)

| Phase | 목표 | 상태 | 진행률 | Exit Criteria |
|---|---|---|---:|---|
| P1 | 기반 구축 | in_progress | 25% | 상태 모니터링/기본 운영 점검 체계 완료 |
| P2 | Extension MVP | in_progress | 53% | YouTube 영상에서 안정적으로 자막 조회/렌더링 |
| P3 | 플랫폼 MVP 코어 | in_progress | 36% | 로그인, 업로드/조회, 버전관리, 기본 편집기 동작 |
| P4 | 플랫폼 MVP 크리에이터 | in_progress | 33% | 채널 연동 + 승인/공개 워크플로우 완료 |
| P5 | 통합 & 안정화 | planned | 0% | 장애 대응/회귀 방지/성능 기준 충족 |
| P6 | 실시간 STT | in_progress | 67% | 전체 STT 파이프라인 안정화 + 렌더러/설정 UI 완성 |
| CS | 공통 시스템 | in_progress | 56% | 자막 포맷/번역 파이프라인 완전 구현 |
| P7 | 타 플랫폼 지원 | planned | 0% | 1개 추가 플랫폼 MVP 완료 |
| P8 | 모더레이터 시스템 | planned | 0% | 신고/검수/운영 플로우 구축 |
| P9 | 성장 기능 | planned | 0% | 신뢰도/팀/검수 자동화/수익화 도입 |

## 5) 상세 로드맵 (체크리스트)

### P1. 기반 구축

Status: `in_progress`

- [x] Status API 확장 (DB/Storage)
- [ ] Uptime Kuma 알림 채널 표준화
- [ ] 운영 환경 점검 체크리스트 문서화
- [ ] 장애 시 복구 시나리오 1차 정리

### P2. Extension MVP

Status: `in_progress`

#### 커뮤니티 자막 로딩
- [x] 영상 ID 기반 자막 조회
- [x] YouTube 공식 자막 바이패스 (정책 제외: LST 자체 렌더러 고정)
- [x] 사용자 언어 우선순위 선택

#### 싱크/렌더링
- [x] 오버레이 렌더링 안정화
- [x] YouTube SPA 이동 감지 후 재초기화
- [ ] 타임스탬프 기준 싱크 보정
- [ ] VTT → YouTube 네이티브 TextTrack 전환
- [ ] 듀얼 자막 모드 (원문 + 번역 동시 표시)

#### UX
- [x] 배지 상태 표시 (자막 있음/없음)
- [x] on/off 토글
- [x] 언어 선택 설정

#### 설정 UI
- [x] 글꼴/색상/크기/테두리/배경 등 기본 설정
- [ ] 텍스트 외곽선 (Text Outline)
- [ ] 텍스트 정렬 (Text Align)
- [ ] Expert Options (고급 설정 패널)

### P3. 플랫폼 MVP 코어

Status: `in_progress`

#### 계정/프로필
- [ ] 핸들 정책 확정 (다국어 허용 범위 포함)
- [x] 핸들 대소문자 처리

#### 플랫폼 UI
- [ ] 메인 홈 구축 (기본)

#### 자막 관리
- [x] 자막 최신 버전 고정 버그 수정
- [x] 업로드/조회 기본 플로우 검증
- [ ] 추천순/다운로드순 정렬
- [ ] diff 비교 (버전 간 변경 내역)
- [ ] 이전 버전 복원
- [ ] 리비전/롤백 정책 문서화

#### 편집기
- [x] 편집 중 실시간 미리보기
- [x] 플랫폼 내 자막 작성(Create) 기능
- [ ] 미리보기 영상 크기 조정 UX
- [ ] SMI/SAMI, TTML 편집 지원 구체화
- [ ] Scripting View (고급 편집기, 베타)

### P4. 플랫폼 MVP 크리에이터

Status: `in_progress`

- [x] 크리에이터 채널 연동 UX 정리
- [ ] 연동 문구 정합성 수정
- [x] 승인 전/후 공개 워크플로우 구현
- [ ] YouTube 자막 업로드 비상 경로 점검
- [ ] 영상 제목/설명란 다국어
  - [ ] 제목/설명 업로드 (`videos.update` localizations)
  - [ ] 제목/설명 입력 UI

### P5. 통합 & 안정화

Status: `planned`

- [ ] Extension <-> API 회귀 테스트 세트
- [ ] 실패 케이스(무응답/자막없음) 공통 처리
- [ ] 모니터링 대시보드 경보 기준 확정
- [ ] API 사용 인증 받기
  - [ ] API 사용 범위에 대한(youtube.force-ssl) 데모 영상 녹화
  - [ ] Data access status 처리

배포 전 점검 → [Release Checklist](../../public/00_core/release-checklist.md)

### P6. 실시간 STT

Status: `in_progress`

Last updated: 2026-05-26

#### 파이프라인 — 탭 오디오 캡처
- [x] 탭 오디오 캡처 (offscreen document, Chrome tabCapture)
- [x] Whisper API 연동 (3s 청크, stop/restart 완전한 webm 보장)
- [x] Realtime API 연동 (WebRTC, gpt-realtime-whisper)
- [x] Realtime API GA 마이그레이션 (/v1/realtime/client_secrets)
- [x] 침묵 감지 타이머 (gpt-realtime-whisper VAD 미지원 대응)
- [x] Delta 누적 표시 (Realtime interim 텍스트 자연스럽게 성장)
- [x] 번역 파이프라인 연결 (Google / Papago / DeepL / Google Script)
- [x] CORS 허용 (manifest host_permissions — DeepL, Papago)

#### 파이프라인 — 마이크 (Web Speech API)
- [x] Web Speech API 연동
- [x] Web Speech API + 번역 연동
- [ ] **[V1 불안정]** Web Speech API 추가 조정 필요

#### 파이프라인 — STT 엔진 확장
- [ ] 서버 제공 STT (할당량/플랜 시스템)
- [ ] 자동 Fallback (Web Speech → Whisper → 서버)
- [ ] 커스텀 엔드포인트 / Hugging Face 지원

#### 자막 렌더러 (SttRenderer)
- [x] STT 전용 렌더러 — 상단(원어) / 하단(번역) 2패널
- [x] 커뮤니티 자막 공통 스타일 시스템 공유
- [x] 팝업/패널 설정 즉시 반영 (updateSettings)
- [x] 컨트롤바 자동 회피 (ytp-autohide 감지)
- [x] 최소 표시 시간 잠금 (completed 자막 → interim 억제)
- [ ] 이전 자막 히스토리 표시 (현재 자막 위 1줄, 60% 크기/40% 불투명도)
- [ ] 후리가나/루비 표시 (베타, kuroshiro + kuromoji.js)
- [ ] 다중 화자 대응 (고급 옵션)
- [ ] 단어장/교정 사전

#### 스트리밍 오버레이
- [ ] Phase A: Extension 단독 오버레이 탭 (OBS 윈도우 캡처 대응)

#### 설정 UI
- [x] 팝업: 엔진 선택 (Whisper / Realtime)
- [x] 팝업: 오디오 소스 선택 (탭 / 마이크)
- [x] 팝업: OpenAI API 키
- [x] 팝업: 번역 엔진 선택 / API 키
- [x] 팝업: 중간 번역 토글 / 엔진
- [x] 패널 실시간 탭: 침묵 감지 시간 / 최소 표시 시간 (엔진별 조건부 표시)
- [x] 팝업/패널: Whisper 모델 선택
- [x] 팝업/패널: Realtime 모델 선택
- [x] 팝업 Realtime 모델명 불일치 수정

#### 검증
- [ ] 중간 번역 실제 동작 확인
- [ ] 언어별 정확도/지연 비교
- [ ] 지연시간 목표 달성 확인 (target: 0.5~2s)

### CS. 공통 시스템

※ 특정 Phase에 종속되지 않는 공통 인프라 — 각 Phase 진행과 병행

#### 자막 포맷 (subtitle-format.md)
- [x] SRT 파싱/직렬화
- [x] VTT 파싱/직렬화
- [ ] SMI/SAMI 파싱/직렬화
- [ ] TTML 파싱/직렬화

#### 번역 파이프라인 (translation-pipeline.md)
- [x] Google Translate 연동
- [x] Naver Papago 연동
- [x] DeepL 연동
- [ ] OpenAI Realtime Translate 경로 검증
- [ ] 번역 캐싱 정책 구현

### P7. 타 플랫폼 지원

Status: `planned`

- [ ] 대상 플랫폼 선정 (우선 1개)
- [ ] 플레이어 DOM/이벤트 어댑터 설계
- [ ] 자막 주입 방식 검증
- [ ] Streaming Overlay Phase B: Lite Helper 로컬 WebSocket 서버 연동

### P8. 모더레이터 시스템

Status: `planned`

#### 신뢰도 / 기여 시스템
- [ ] 익명 기여 시스템 (업로드 시 익명 옵션)
- [ ] 신뢰도 점수 구현 (자동 점수 / 유저 점수 / 통합 점수)
- [ ] Contribution Weight (신뢰도 높은 유저 평가 가중치)
- [ ] 기여 내역 / 위반 기록 관리

#### 신고 / 모더레이션
- [ ] 신고 분류 체계 (D~S 레벨)
- [ ] 검수 큐/처리 정책
- [ ] 제재/이의제기 기준
- [ ] 모더레이터 선정·역할·권한 체계
- [ ] 갈등 대응 프로토콜

#### 운영 시스템
- [ ] 운영 게시판 시스템 (공지/업데이트/정책, 다국어 ko/en/ja)
- [ ] 1:1 문의/이의제기 시스템 (티켓)
- [ ] 신고 처리 상태 조회
- [ ] 다국어 운영 정책 (자동번역 + 검수 상태)

### P9. 성장 기능

Status: `planned`

#### 자막 품질 향상
- [ ] Whisper 기반 자동 싱크 조정
- [ ] AI 문장 개선 옵션 (자연화/말투 보정)
- [ ] AI Context Translation (LLM 번역, quality mode)
- [ ] Local LLM 경로 (Ollama/LM Studio, Desktop App 경유)
- [ ] 번역 프리셋 (provider/style/character/glossary)
- [ ] ASS 자막 지원 (고급 렌더러)

#### 커뮤니티
- [ ] 신뢰도 점수 도입 조건 정리
- [ ] 번역 팀 운영 모델 (채널당 최대 2팀)
- [ ] 언어 시험/검수자 제도 연결
- [ ] AI 자동 검수 범위 정의
- [ ] 공식 아티스트 음악 영상 다국어 가사 자막 기능 검토

#### 수익화
- [ ] 수익화 단계별 적용

## 6) 현재 주간 집중 항목

- [ ] 메인 홈(기본) 구축
- [ ] 자막 편집기 편의성 업데이트
- [ ] 연동 안내 문구 정리

## 7) 업데이트 규칙

- 진행률은 매주 1회 업데이트한다.
- `completed`는 "구현 + 기본 검증"을 모두 충족해야 체크한다.
- 기능 스펙 변경 시 관련 제품 문서(Extension/Platform/Desktop App) 또는 공통 시스템 문서 링크를 함께 갱신한다.
- CS(공통 시스템)는 체크박스 변경 시 즉시 반영한다.

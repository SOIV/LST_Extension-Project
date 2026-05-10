# LST 프로젝트 로드맵

Last updated: 2026-05-06 (code sync)

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

| Phase | 목표 | 상태 | 진행률 | Exit Criteria (완료 기준) |
|---|---|---|---:|---|
| P1 | 기반 구축 | in_progress | 65% | 상태 모니터링/기본 운영 점검 체계 완료 |
| P2 | Extension MVP | in_progress | 70% | YouTube 영상에서 안정적으로 자막 조회/렌더링 |
| P3 | 플랫폼 MVP 코어 | in_progress | 70% | 로그인, 업로드/조회, 버전관리, 기본 편집기 동작 |
| P4 | 플랫폼 MVP 크리에이터 | in_progress | 60% | 채널 연동 + 승인/공개 워크플로우 완료 |
| P5 | 통합 & 안정화 | planned | 10% | 장애 대응/회귀 방지/성능 기준 충족 |
| P6 | 실시간 STT (Web Speech) | planned | 0% | 실시간 파이프라인 MVP 검증 |
| P7 | 타 플랫폼 지원 | planned | 0% | 1개 추가 플랫폼 MVP 완료 |
| P8 | 모더레이터 시스템 | planned | 0% | 신고/검수 운영 플로우 구축 |
| P9 | 성장 기능 | planned | 0% | 신뢰도/팀/검수 자동화/수익화 도입 |

## 5) 상세 로드맵 (체크리스트)

### P1. 기반 구축

Status: `in_progress`

- [x] Status API 확장 (DB/Storage) **#TODO.md**
- [ ] Uptime Kuma 알림 채널 표준화
- [ ] 운영 환경 점검 체크리스트 문서화
- [ ] 장애 시 복구 시나리오 1차 정리

### P2. Extension MVP

Status: `in_progress`

#### 자막 로딩
- [x] 영상 ID 기반 자막 조회
- [x] YouTube 공식 자막 바이패스 (정책 제외: LST 자체 렌더러 고정)
- [x] 사용자 언어 우선순위 선택

#### 싱크/렌더링
- [x] 오버레이 렌더링 안정화
- [x] YouTube SPA 이동 감지 후 재초기화
- [ ] 타임스탬프 기준 싱크 보정

#### UX
- [x] 배지 상태 표시 (자막 있음/없음)
- [x] on/off 토글
- [x] 언어 선택 설정

### P3. 플랫폼 MVP 코어

Status: `in_progress`

#### 계정/프로필
- [ ] 핸들 정책 확정 (다국어 허용 범위 포함) **#TODO.md**
- [x] 핸들 대소문자 처리 **#TODO.md**

#### 자막 관리
- [x] 자막 최신 버전 고정 버그 수정 **#TODO.md**
- [x] 업로드/조회 기본 플로우 검증
- [ ] 리비전/롤백 정책 문서화

#### 편집기
- [x] 편집 중 실시간 미리보기 **#TODO.md**
- [ ] 미리보기 영상 크기 조정 UX **#TODO.md**
- [ ] SMI/SAMI/TTML 편집 지원 구체화 **#TODO.md**
- [x] 플랫폼 내 자막 작성(Create) 기능 **#TODO.md**

### P4. 플랫폼 MVP 크리에이터

Status: `in_progress`

- [x] 크리에이터 채널 연동 UX 정리
- [ ] 연동 문구 정합성 수정 **#TODO.md**
- [x] 승인 전/후 공개 워크플로우 구현
- [ ] YouTube 자막 업로드 비상 경로 점검 **#TODO.md**
- [ ] 영상 제목/설명란 관련
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

### P6. 실시간 STT (Web Speech API)

Status: `planned`

- [ ] 지연시간 목표 정의 (target: 0.5~2s)
- [ ] STT -> 번역 -> 렌더 파이프라인 연결
- [ ] 언어별 정확도/지연 비교 리포트

### P7. 타 플랫폼 지원

Status: `planned`

- [ ] 대상 플랫폼 선정 (우선 1개)
- [ ] 플레이어 DOM/이벤트 어댑터 설계
- [ ] 자막 주입 방식 검증

### P8. 모더레이터 시스템

Status: `planned`

- [ ] 신고 분류 체계
- [ ] 검수 큐/처리 정책
- [ ] 제재/이의제기 기준

### P9. 성장 기능

Status: `planned`

- [ ] 신뢰도 점수 도입 조건 정리
- [ ] 번역 팀 운영 모델
- [ ] 언어 시험/검수자 제도 연결
- [ ] AI 자동 검수 범위 정의
- [ ] 수익화 단계별 적용

## 6) 현재 주간 집중 항목

- [ ] 메인 홈(기본) 구축  **#TODO.md**
- [ ] 자막 편집기 편의성 업데이트 **#TODO.md**
- [ ] 연동 안내 문구 정리 **#TODO.md**
- [ ] 정보 탭 업데이트 **#TODO.md**

## 7) 업데이트 규칙

- 진행률은 매주 1회 업데이트한다.
- `completed`는 "구현 + 기본 검증"을 모두 충족해야 체크한다.
- 기능 스펙 변경 시 관련 제품 문서(Extension/Platform/Desktop App) 또는 공통 시스템 문서 링크를 함께 갱신한다.

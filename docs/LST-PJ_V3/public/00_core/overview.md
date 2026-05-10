# LST-PJ_V3 Project Overview

Status: active

Last updated: 2026-05-10

이 문서는 LST-PJ_V3의 상위 방향을 정리한다.
상세 구현은 Extension, Platform, Desktop App, Shared Systems 문서에서 나누어 관리한다.

## Current Direction

LST는 YouTube 영상/라이브를 중심으로 **커뮤니티 자막 플랫폼, Chrome Extension, 실시간 STT/번역, Desktop 보조 환경**을 연결하는 프로젝트다.

현재 우선 안정화 대상은 다음 두 축이다.

- Community Subtitle Platform: 자막 업로드, 조회, 편집, 리비전, 크리에이터 승인 흐름
- Chrome Extension: YouTube 페이지에서 LST 커뮤니티 자막을 조회하고 자체 오버레이로 표시

실시간 STT/번역은 후속으로 밀어두는 기능이 아니라, 위 두 축과 병행 가능한 별도 트랙으로 관리한다.
다만 릴리즈 범위는 엔진 안정성, 지연시간, 비용, 권한, 사용자 설정 복잡도에 따라 단계적으로 분리한다.

## Product Areas

| Area | Role | Current Position |
|---|---|---|
| Platform | 커뮤니티 자막 저장/관리/편집 | MVP 핵심 |
| Chrome Extension | YouTube 위 자막 조회/표시 | MVP 핵심 |
| Realtime STT | 음성 입력을 원문 텍스트로 전사 | 병행 검증 트랙 |
| Translation Pipeline | 원문 텍스트 또는 음성을 번역 자막으로 변환 | 병행 검증 트랙 |
| Lite Helper | Extension 단독 처리 한계 보완 | 선택 보조 환경 |
| Full Desktop App | 고급 STT, AI 번역, 편집/내보내기 | 장기/전문 작업 환경 |

## Core Principles

- YouTube 커뮤니티 자막 플랫폼과 Extension 흐름을 먼저 안정화한다.
- STT는 `후속 기능`으로 고정하지 않고, Extension 단독, 서버 제공, 사용자 API 키, Desktop 보조 경로를 모두 후보로 둔다.
- Desktop App은 Whisper 자체가 목적이 아니라 지연/렉/오디오 캡처/고급 AI 처리 한계를 줄이는 실행 환경으로 본다.
- 민감한 사업/운영/외주 초안은 `sensitive-draft`로 분류하고 커밋 제외 상태를 유지한다.
- 공개 docs 사이트에는 `public` 문서를 기반으로 재작성한 내용만 포함한다.

## High-Level Flows

### Community Subtitle Flow

```text
YouTube videoId
 -> Platform subtitle API
 -> Extension language/version selection
 -> Overlay renderer
 -> User settings
```

### Realtime STT Flow

```text
Audio input
 -> STT engine
 -> transcript
 -> overlay or translation pipeline
```

### Realtime Speech Translation Flow

```text
Audio input
 -> input transcription
 -> translation model/provider
 -> translated subtitle
 -> overlay renderer
```

### Desktop-Assisted Flow

```text
Extension
 -> local bridge / WebSocket
 -> Lite Helper or Full Desktop App
 -> STT/translation/AI processing
 -> Extension overlay
```

## Roadmap Entry Points

- [Roadmap](../../planning/00_core/roadmap.md)
- [Extension Overview](../10_extension/overview.md)
- [Platform Overview](../20_platform/overview.md)
- [Desktop App Overview](../30_desktop-app/overview.md)
- [STT Engine Selection](../40_shared-systems/stt-engine-selection.md)
- [Translation Pipeline](../40_shared-systems/translation-pipeline.md)

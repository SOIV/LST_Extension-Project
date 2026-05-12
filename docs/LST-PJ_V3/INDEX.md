# LST-PJ_V3 Document Index

Last updated: 2026-05-10

Classification: [_classification.md](_classification.md)

## Core

| Status | Document | Purpose |
|---|---|---|
| active | [Project Overview](public/00_core/overview.md) | 전체 프로젝트 방향과 상위 개요 |
| active | [Roadmap](planning/00_core/roadmap.md) | Phase별 진행 상태와 체크리스트 |
| planned | [Release & Review Checklist](public/00_core/release-checklist.md) | 배포/심사/개인정보/권한 체크리스트 |

## Extension

| Status | Document | Purpose |
|---|---|---|
| active | [Extension Overview](public/10_extension/overview.md) | Chrome Extension 전체 구조 |
| active | [Community Subtitles](public/10_extension/community-subtitles.md) | 플랫폼 자막 조회/표시 |
| planned | [Realtime STT](public/10_extension/realtime-stt.md) | Extension 단독 Web Speech/Whisper API 실시간 자막 |
| active | [Overlay Renderer](public/10_extension/overlay-renderer.md) | YouTube 오버레이 렌더링 구조 |
| active | [Settings UI](public/10_extension/settings-ui.md) | 팝업/플레이어 패널 설정 UI |
| planned | [Streaming Overlay](public/10_extension/streaming-overlay.md) | OBS 연동 및 전용 오버레이 창 (Phase A~C) |

## Platform

| Status | Document | Purpose |
|---|---|---|
| active | [Platform Overview](public/20_platform/overview.md) | 웹 플랫폼 전체 구조 |
| active | [Community Subtitle Platform](public/20_platform/community-subtitle-platform.md) | 자막 업로드/조회/관리 플랫폼 |
| in_progress | [Subtitle Editor](public/20_platform/subtitle-editor.md) | 웹 자막 편집기와 리비전 |
| in_progress | [Creator Workflow](public/20_platform/creator-workflow.md) | 크리에이터 연동과 승인 흐름 |
| active | [Account & Trust System](planning/20_platform/account-trust-system.md) | 계정/신뢰도 시스템 |
| draft | [Reviewer Test Design](planning/20_platform/reviewer-test-design.md) | 언어 시험/검수자 설계 |
| draft | [Official Artist Lyric Localization](planning/20_platform/official-artist-lyric-localization.md) | 공식 아티스트 음악 영상 다국어 가사 자막 장기 아이디어 |
| local-only | `sensitive-draft/20_platform/outsourcing-draft.md` | 번역 외주 시스템 초안, 커밋 제외 |

## Desktop App

| Status | Document | Purpose |
|---|---|---|
| active | [Desktop App Overview](public/30_desktop-app/overview.md) | Desktop App 전체 구조 |
| active | [Desktop App Modes](public/30_desktop-app/app-modes.md) | Lite Helper와 Full Desktop App 구분 |
| planned | [Desktop STT Runtime](public/30_desktop-app/stt-runtime.md) | Desktop 보조/독립 STT 실행 환경 |
| planned | [Desktop AI Runtime](public/30_desktop-app/ai-runtime.md) | 고급 AI 번역, 로컬 LLM, 프리셋 실행 환경 |
| planned | [Audio Capture](public/30_desktop-app/audio-capture.md) | 시스템 오디오 캡처 |
| planned | [Extension Bridge](public/30_desktop-app/extension-bridge.md) | Desktop App과 Extension 연동 |

## Shared Systems

| Status | Document | Purpose |
|---|---|---|
| final | [STT Engine Selection](public/40_shared-systems/stt-engine-selection.md) | Web Speech/Whisper 계열 선택 UI와 기준 |
| active | [Subtitle Display](public/40_shared-systems/subtitle-display.md) | 자막 표시 방식과 우선순위 |
| planned | [Subtitle Format](public/40_shared-systems/subtitle-format.md) | SRT/VTT/SMI/TTML 포맷 처리 기준 |
| planned | [Translation Pipeline](public/40_shared-systems/translation-pipeline.md) | 번역 API, AI 번역, 실시간 음성 번역 파이프라인 |

## Strategy

| Status | Document | Purpose |
|---|---|---|
| local-only | `sensitive-draft/50_strategy/revenue-model.md` | 수익 모델 초안, 커밋 제외 |
| local-only | `sensitive-draft/50_strategy/funding.md` | 펀딩 전략 초안, 커밋 제외 |
| active | [Library Architecture](public/50_strategy/library-architecture.md) | 라이브러리 분리 전략 |

## Ideas & Archive

| Status | Document | Purpose |
|---|---|---|
| draft | [Subtitle Experiments](planning/90_ideas/subtitle-experiments.md) | 자막 관련 실험 아이디어 |
| local-only | `sensitive-draft/99_archive/2026-05/revenue-strategy-legacy.md` | 이전 수익 전략, 커밋 제외 |
| archived | [STT Engine UI (Legacy Draft)](99_archive/2026-05/stt-engine-ui-legacy-draft.md) | 이전 STT UI 초안 |

## Assets

- Player design source: `info-file/1080_player-screen.psd`
- Player preview: `info-file/1080_player-screen.png`

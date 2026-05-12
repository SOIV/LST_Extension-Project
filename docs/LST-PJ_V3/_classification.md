# LST-PJ_V3 Document Classification

Last updated: 2026-05-10

이 문서는 `docs/LST-PJ_V3` 문서의 공개 수준을 분류한다.
제품별 폴더 구조는 유지하고, 공개 가능 여부는 이 문서에서 별도로 관리한다.

## Classification Levels

| Level | Meaning | Repository Policy |
|---|---|---|
| `public` | 사용자/기여자/외부인이 봐도 되는 문서 | 공개 docs 사이트 또는 개발자 문서로 승격 가능 |
| `planning` | 초안, 아이디어, 구현 전 논의 | 공개 레포에 둘 수 있으나 초안임을 명시 |
| `sensitive-draft` | 사업/가격/운영/외주/보안 등 오해 가능성이 있는 문서 | 로컬 전용 폴더로 유지하고 커밋/배포 대상에서 제외 |
| `archive` | 이전 버전/참고용 | 공개 여부는 원본 성격을 따른다 |

## Public Candidates

| Document | Level | Notes |
|---|---|---|
| `public/00_core/overview.md` | public | 프로젝트 전체 소개/아키텍처 |
| `public/00_core/release-checklist.md` | public | 배포/심사/개인정보/권한 체크리스트 |
| `public/10_extension/overview.md` | public | Extension 개발 개요 |
| `public/10_extension/community-subtitles.md` | public | 사용자/개발자 모두 참고 가능 |
| `public/10_extension/realtime-stt.md` | public | STT 기능 설명, provider 정책은 초안 주의 |
| `public/10_extension/overlay-renderer.md` | public | Extension 렌더링 설계 |
| `public/10_extension/settings-ui.md` | public | Extension 설정 UI |
| `public/20_platform/overview.md` | public | 플랫폼 개요 |
| `public/20_platform/community-subtitle-platform.md` | public | 플랫폼 기능 개요, 일부 AI/Helper 내용은 planning 성격 |
| `public/20_platform/subtitle-editor.md` | public | 편집기 기능 |
| `public/20_platform/creator-workflow.md` | public | 크리에이터 연동/승인 흐름 |
| `public/30_desktop-app/overview.md` | public | Desktop 계열 개요 |
| `public/30_desktop-app/app-modes.md` | public | Lite Helper / Full Desktop App 구분 |
| `public/30_desktop-app/stt-runtime.md` | public | Desktop STT runtime 개요 |
| `public/30_desktop-app/audio-capture.md` | public | 오디오 캡처 설계 |
| `public/30_desktop-app/extension-bridge.md` | public | Extension 연동 구조 |
| `public/30_desktop-app/ai-runtime.md` | public | 고급 AI 기능의 Desktop 경계 |
| `public/40_shared-systems/subtitle-display.md` | public | 자막 표시 정책 |
| `public/40_shared-systems/subtitle-format.md` | public | 자막 포맷 정책 |
| `public/40_shared-systems/stt-engine-selection.md` | public | STT 엔진 선택 기준 |
| `public/40_shared-systems/translation-pipeline.md` | public | 번역 provider/AI 번역 정책 |
| `public/50_strategy/library-architecture.md` | public | 개발자용 라이브러리 분리 전략 |

## Planning Documents

| Document | Level | Notes |
|---|---|---|
| `planning/00_core/roadmap.md` | planning | 공개 가능하지만 확정 약속으로 보이지 않게 주의 |
| `planning/20_platform/account-trust-system.md` | planning | 정책 초안. 악용 대응/운영 세부는 공개 범위 주의 |
| `planning/20_platform/reviewer-test-design.md` | planning | 검수자/언어 시험 초안 |
| `planning/20_platform/official-artist-lyric-localization.md` | planning | 공식 아티스트 음악 영상 다국어 가사 자막 장기 아이디어 |
| `planning/90_ideas/subtitle-experiments.md` | planning | 실험 아이디어 |

## Sensitive Drafts

| Document | Level | Recommended Action |
|---|---|---|
| `sensitive-draft/50_strategy/revenue-model.md` | sensitive-draft | 로컬 전용 유지, 커밋 제외 |
| `sensitive-draft/50_strategy/funding.md` | sensitive-draft | 로컬 전용 유지, 커밋 제외 |
| `sensitive-draft/20_platform/outsourcing-draft.md` | sensitive-draft | 로컬 전용 유지, 커밋 제외 |
| `sensitive-draft/99_archive/2026-05/revenue-strategy-legacy.md` | sensitive-draft | 로컬 전용 유지, 커밋 제외 |

## Docs Site Policy

Docusaurus 또는 별도 docs 사이트는 공개 문서만 사용한다.

| Target | Source |
|---|---|
| User Guide | `public` 문서 중 사용자에게 필요한 내용만 재작성 |
| Developer Guide | `public` 문서 중 개발/기여에 필요한 내용만 재작성 |
| Internal/Planning | `planning` 문서는 그대로 Markdown으로 유지 |
| Sensitive Draft | `sensitive-draft` 문서는 docs 사이트에 포함하지 않음 |

## Local/Internal Access Idea

민감 문서는 `sensitive-draft` 로컬 전용 폴더에 두고 커밋/배포 대상에서 제외한다.
현재 정책은 다음과 같다.

- 기본: local-only folder excluded by `.gitignore`
- 필요 시: private repository, encrypted notes, 별도 self-hosted private docs 검토

로컬 전용 문서를 외부에서 볼 필요가 생기면, 공개 docs 사이트와 분리된 private docs 배포 경로를 따로 둔다.

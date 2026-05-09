# Desktop App Modes

Status: active

Desktop 계열은 하나의 앱만 의미하지 않는다.
목적에 따라 **Lite Helper**와 **Full Desktop App**으로 분리한다.

## Mode Summary

| Mode | Purpose | Main User | Notes |
|---|---|---|---|
| Lite Helper | Extension 보조 실행 환경 | 일반 사용자/실시간 시청자 | 지연, 렉, 브라우저 한계를 줄이는 경량 보조 앱 |
| Full Desktop App | 전문 자막 제작/AI 처리 환경 | 번역자/크리에이터/운영자 | 전체 영상 처리, 고급 편집, AI 보정, 프리셋 중심 |

## Lite Helper

Extension 단독 처리에서 발생할 수 있는 지연, 렉, 오디오 캡처 한계를 줄이기 위한 보조 프로그램이다.
항상 로컬 Whisper만 의미하지 않는다.

### Scope

- Extension과 WebSocket/로컬 브릿지 연결
- 시스템 오디오 캡처 보조
- STT/번역 파이프라인 일부 오프로딩
- 긴 영상 싱크 계산 보조
- 자막 포맷 변환 보조
- OCR 또는 스냅샷 분석 같은 브라우저 밖 작업 보조
- 단순 AI/LLM 작업을 Extension 대신 처리

### Non-goals

- 전문 편집기 전체 제공
- 계정/기여도 관리의 주 UI 담당
- 모든 자막 제작 기능을 독립적으로 제공
- 복잡한 프리셋 편집 UI 제공

## Full Desktop App

자막 제작과 고급 처리를 위한 독립형 앱이다.
Extension 보조를 넘어서 전체 영상 작업, 고급 편집, AI 처리, 내보내기를 담당할 수 있다.

### Scope

- 전체 영상 Whisper STT 생성
- 고급 자막 편집 UI
- AI 자동 번역/싱크 보정
- Ollama/LM Studio 등 로컬 LLM 연동
- 번역 프리셋/용어집/말투 설정
- 자막 렌더링/내보내기
- 커뮤니티 자막 등록/업데이트
- 계정 연동 및 기여 관리

## Related Documents

- [Desktop App Overview](overview.md)
- [Desktop STT Runtime](stt-runtime.md)
- [Desktop AI Runtime](ai-runtime.md)
- [Audio Capture](audio-capture.md)
- [Extension Bridge](extension-bridge.md)

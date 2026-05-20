# Desktop App STT Runtime

Status: planned

Desktop 계열 앱에서 STT 처리를 보조하거나 직접 수행하는 실행 환경을 다룬다.
핵심 목적은 Extension 단독 처리에서 발생할 수 있는 지연, 렉, 오디오 캡처 한계를 줄이는 것이다.

## Scope

- Lite Helper의 STT/번역 처리 오프로딩
- Full Desktop App의 로컬 Whisper 기반 음성 인식
- CPU/GPU 실행 옵션
- 모델 선택
- 시스템 오디오 캡처 결과를 STT로 전달
- Extension으로 결과 전달

## Out of Scope

- 브라우저 Web Speech API
- Extension 내부 Web Speech STT
- Extension 단독 Whisper API 처리
- 서버 제공 Whisper API
- 사용자 API 키 기반 Whisper API

## Runtime Modes

| Mode | STT Role | Notes |
|---|---|---|
| Lite Helper | 보조 처리/오프로딩 | Extension의 지연/렉 감소, 브라우저 밖 오디오/처리 보조 |
| Full Desktop App | 독립 처리 | 로컬 STT, 장치 설정, CPU/GPU 실행 옵션, Extension 연동을 세밀하게 관리 |

## Whisper Position

Whisper는 Desktop App의 중요한 선택지지만 Desktop App의 정의 자체는 아니다.
Desktop App은 더 나은 실시간 처리, 안정적인 오디오 캡처, Extension 연동, 로컬 AI 실행을 위한 실행 환경이다.

## Related Documents

- [Desktop App Overview](overview.md)
- [Desktop App Modes](app-modes.md)
- [Audio Capture](audio-capture.md)
- [Extension Bridge](extension-bridge.md)
- [STT Engine Selection](../40_shared-systems/stt-engine-selection.md)

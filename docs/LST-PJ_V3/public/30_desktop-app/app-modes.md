# Desktop App Modes

Status: active

Desktop 계열은 하나의 앱만 의미하지 않는다.
목적에 따라 **Lite Helper**와 **Full Desktop App**으로 분리한다.

## Mode Summary

| Mode | Purpose | Main User | Notes |
|---|---|---|---|
| Lite Helper | Extension 보조 실행 환경 | 일반 사용자/실시간 시청자 | 지연, 렉, 브라우저 한계를 줄이는 경량 보조 앱 |
| Full Desktop App | 독립 실행형 고급 처리 환경 | 고급 사용자/스트리머/운영자 | 실시간 STT/번역, 로컬 AI 처리, 장치 설정, 연동 관리 중심 |

## 공통 구조

두 앱은 **같은 엔진**을 쓰고, 화면과 실행 방식만 다르다. (2026-11-06 결정)

| 구분 | Lite Helper | Full Desktop App |
|---|---|---|
| 엔진 | LST Engine (Python), `lite` 프로필 | LST Engine (Python), `full` 프로필 |
| 앱 껍데기 | Tauri (Rust) | Tauri (Rust) |
| 화면 | 트레이 아이콘 + 간단한 상태 창 | 설정, 모델 관리, 프리셋 편집 등 전체 화면 |
| Extension | 필요 (Extension이 주 사용 화면) | 선택 (없어도 단독 사용 가능) |

- 두 앱의 엔진 허용 범위 차이는 엔진을 두 벌 만들지 않고 **프로필 설정**으로 나눈다.
- Full Desktop App은 Lite Helper 기능을 모두 포함한다. 그래서 Lite Helper → Full Desktop App은 업그레이드에 해당한다.

### 설치와 전환

- 한 PC에는 **둘 중 하나만** 설치한다. 설치 프로그램이 다른 쪽을 발견하면 전환을 안내하고, 기존 앱을 제거한 뒤 설치한다.
- 모델, 설정, API 키, Extension 연결 정보는 앱 폴더가 아니라 **공용 데이터 폴더**(`%LOCALAPPDATA%\LST\`)에 둔다. 전환하거나 재설치해도 그대로 이어진다.
- 엔진도 자체적으로 중복 실행을 막는다(이미 실행 중이면 새로 뜨지 않음). 설치 과정을 거치지 않는 포터블 zip과 개발 빌드에 대비한 장치다.

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

- 전문 자막 편집기 전체 제공
- 계정/기여도 관리의 주 UI 담당
- 모든 자막 제작 기능을 독립적으로 제공
- 복잡한 프리셋 편집 UI 제공

## Full Desktop App

확장 프로그램 보조를 넘어서 독립적으로 실행되는 고급 처리 앱이다.
목적은 자막 제작/편집기가 아니라, 안정적인 오디오 캡처, 실시간 STT/번역, 로컬 AI 처리, 장치 설정과 Extension 연동을 더 세밀하게 관리하는 것이다.

### Scope

- **Lite Helper의 모든 기능** (Extension 연동, 싱크 계산 보조, 자막 포맷 변환, OCR/스냅샷 분석, 단순 AI/LLM 작업 등)
  - Extension 없이도 단독으로 쓰는 앱이므로, Lite Helper에서 되는 기능이 Full Desktop App에서 빠지면 안 된다.
- 안정적인 시스템 오디오 캡처
- 로컬 Whisper 또는 고성능 STT 실행
- 실시간 번역 및 후처리
- Ollama/LM Studio 등 로컬 LLM 연동
- 번역 프리셋/용어집/말투 설정
- CPU/GPU 실행 옵션과 모델 관리
- Extension 연결 상태와 로컬 브릿지 관리
- 스트리머/프로 방송용 실시간 처리 환경 대응

## Related Documents

- [Desktop App Overview](overview.md)
- [Desktop STT Runtime](stt-runtime.md)
- [Desktop AI Runtime](ai-runtime.md)
- [Audio Capture](audio-capture.md)
- [Extension Bridge](extension-bridge.md)

# Desktop App AI Runtime

Status: planned

고급 AI 번역, 로컬 LLM, 프리셋 기반 후처리는 Desktop 계열에서 담당한다.
Extension은 가벼운 실시간 기능을 유지하고, 복잡한 AI 기능은 Desktop App 또는 Lite Helper로 분리한다.

## Purpose

- Extension의 복잡도와 브라우저 제약을 줄인다.
- Ollama/LM Studio 같은 로컬 LLM을 안정적으로 호출한다.
- 긴 자막 번역, 큐, 캐시, timeout, retry를 관리한다.
- 고급 사용자에게 Desktop App 설치 이유를 명확히 제공한다.

## Scope

- Ollama/LM Studio/llama.cpp/vLLM 연동
- AI context translation
- 자막 일괄 번역
- 용어집/말투/캐릭터 프리셋
- 번역 품질 후처리
- 큐, 캐시, rate limit, timeout 관리
- Extension bridge를 통한 결과 전달

## Preset System

고급 AI 기능은 프리셋 단위로 관리한다.

| Preset | Purpose |
|---|---|
| Provider preset | Ollama/OpenAI/Gemini/custom endpoint 및 모델 선택 |
| Style preset | 직역, 자연스러운 번역, 팬자막 톤, 방송 자막 톤 |
| Character preset | 캐릭터 말투, 호칭, 금지 표현 |
| Glossary preset | 고유명사, 기술 용어, 채널별 용어집 |
| Processing preset | chunk size, context window, retry, timeout, cache |
| Output preset | 줄바꿈, 길이 제한, 타임코드 보존 방식 |

## Extension Boundary

Extension은 아래 기능을 직접 제공하지 않는 것을 원칙으로 한다.

- Ollama 직접 연결
- 장문 AI 문맥 번역
- 대용량 자막 일괄 번역
- 복잡한 프리셋 편집 UI
- 로컬 GPU/CPU 리소스 관리
- 긴 timeout/queue/cache 관리

Extension은 Desktop App/Lite Helper 연결 상태와 실행 결과를 표시하는 역할에 집중한다.

## Related Documents

- [Desktop App Modes](app-modes.md)
- [Desktop STT Runtime](stt-runtime.md)
- [Extension Bridge](extension-bridge.md)
- [Translation Pipeline](../40_shared-systems/translation-pipeline.md)

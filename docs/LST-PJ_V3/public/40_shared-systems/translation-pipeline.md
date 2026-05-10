# Translation Pipeline

Status: planned

STT 또는 커뮤니티 자막 텍스트가 번역되어 표시되기까지의 공통 파이프라인을 다룬다.

STT와 번역은 한 기능처럼 보일 수 있지만, 문서에서는 다음 두 단계를 분리해서 관리한다.

- Transcription/STT: 음성 입력을 원문 transcript로 변환
- Translation: 원문 transcript 또는 음성 번역 경로를 번역 자막으로 변환

## Scope

- STT 결과 텍스트 정규화
- 번역 API 연결
- OpenAI Realtime Translate 기반 실시간 음성 번역 검토
- Realtime Translate의 input transcription model 구분
- AI 번역 provider 연결
- 사용자 API 키 방식
- 캐싱 정책
- 자막 렌더링 전달 형식

## Pipeline Split

### Text translation

커뮤니티 자막이나 STT 결과 텍스트를 일반 번역 provider에 전달하는 기본 경로다.

```text
source text
 -> text normalization
 -> translation provider
 -> translated subtitle
 -> renderer
```

### Realtime speech translation

음성 입력을 실시간 번역 자막으로 바로 연결하는 경로다.

```text
audio
 -> input transcription model
 -> translation model
 -> translated subtitle
 -> renderer
```

OpenAI Realtime Translate UI 기준으로는 `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `gpt-4o-transcribe-diarize`가 input transcription model 역할을 하고, `gpt-realtime-translate`가 translation model 역할을 한다.

## Translation Providers

| Provider | Role | Notes |
|---|---|---|
| Google Translate | 기본/무료 후보 | 공식/비공식 사용 경로와 안정성 검토 필요 |
| Naver Papago | 한/일/영 번역 후보 | 한국어/일본어 중심 품질 검토 |
| DeepL | 고품질 번역 후보 | 품질은 좋지만 비용과 제한 검토 필요 |
| OpenAI Realtime Translate | 실시간 음성 번역 후보 | input transcription model + `gpt-realtime-translate` 경로 |
| OpenAI / Gemini / Claude / LLM | AI 문맥 번역 후보 | 속도는 느릴 수 있으나 문맥/말투/용어집 반영에 유리 |
| Local LLM (Ollama/LM Studio) | 로컬 AI 번역 후보 | Desktop App/Lite Helper 경유를 원칙으로 함 |
| Custom API | 고급 사용자용 | 단순 HTTP API만 Extension 직접 연결 후보 |

## Translation Modes

| Mode | Priority | Use Case | Tradeoff |
|---|---|---|---|
| Fast Machine Translation | speed | 실시간 방송 자막 | 문맥 품질은 제한적일 수 있음 |
| Realtime Voice Translation | latency | 음성 입력을 바로 번역 | provider 비용/지원 언어 확인 필요 |
| AI Context Translation | quality | 저장 자막, 편집기, 고품질 번역 | 실시간에는 지연이 커질 수 있음 |
| Custom Provider | flexibility | 고급 사용자/자체 서버 | 설정 복잡도 증가 |

## Provider Execution Policy

| Provider Type | Extension Direct | Desktop/Lite Helper | Policy |
|---|---:|---:|---|
| Google/Papago/DeepL | allowed | optional | 일반 번역 API |
| OpenAI hosted API | allowed | optional | 사용자 API 키 또는 서버 제공 |
| Simple Custom HTTP API | advanced only | recommended | CORS/보안/timeout 주의 |
| Local LLM (Ollama/LM Studio/llama.cpp) | not recommended | required | 로컬 리소스, 큐, 프리셋, 장문 처리 필요 |
| AI Context Translation | not recommended | recommended | 품질 우선 모드, 지연/비용 관리 필요 |
| Batch Subtitle Translation | no | required | 긴 자막, segment mapping, 캐시 필요 |

## AI Context Translation

AI 번역은 실시간 자막의 기본 경로로 두기에는 속도와 비용 부담이 크다.
다만 다음 상황에서는 선택 옵션으로 제공할 가치가 있다.

- 커뮤니티 자막 업로드 후 고품질 번역 생성
- 자막 편집기에서 문장 자연화/말투 보정
- 용어집, 인명, 캐릭터 말투를 반영한 번역
- 라이브가 아닌 VOD/클립의 후처리 번역
- 사용자가 속도보다 품질을 우선하는 경우

정책:

- 실시간 기본값은 빠른 번역 provider를 우선한다.
- AI 번역은 `quality mode` 또는 후처리 기능으로 분리한다.
- 사용자 API 키 또는 별도 유료 플랜과 연결한다.
- Ollama/LM Studio 같은 로컬 LLM은 Desktop App 또는 Lite Helper 경유를 원칙으로 한다.
- 긴 자막은 문맥 단위로 묶되, 타임코드가 깨지지 않도록 segment mapping을 유지한다.
- 같은 문장/구간은 캐시하여 비용과 지연을 줄인다.

## Presets

고급 AI 번역은 프리셋이 필요하다.
프리셋은 Extension보다 Desktop 계열에서 관리하는 것이 안정적이다.

필요한 프리셋 예:

- Provider/model preset: Ollama 모델, OpenAI/Gemini 모델, custom endpoint
- Style preset: 직역, 자연스러운 번역, 팬자막 톤, 방송 자막 톤
- Character/persona preset: 캐릭터 말투, 호칭, 금지 표현
- Glossary preset: 고유명사, 기술 용어, 채널별 용어집
- Processing preset: chunk size, context window, retry, timeout, cache policy
- Output preset: 자막 길이 제한, 줄바꿈, 타임코드 보존 방식

## Realtime Voice Translation

OpenAI `gpt-realtime-translate`는 실시간 음성 번역 후보로 별도 추적한다.
텍스트 STT 결과를 일반 번역 API에 넘기는 기존 방식과 달리, Realtime Translate 경로는 input transcription model과 translation model을 한 플로우에서 조합한다.

| Step | OpenAI Candidate | Role |
|---|---|---|
| Input transcription | `gpt-4o-transcribe` | 음성을 원문 transcript로 변환 |
| Input transcription | `gpt-4o-mini-transcribe` | 비용/속도 우선 transcript 생성 |
| Input transcription | `gpt-4o-transcribe-diarize` | 다중 화자 transcript 생성 |
| Translation | `gpt-realtime-translate` | 원문 transcript/음성 컨텍스트를 번역 |

이 경로는 번역 자막용이며, STT 단독 자막은 [Extension Realtime STT](../10_extension/realtime-stt.md)의 `gpt-realtime-whisper` 경로를 우선 검토한다.

Source:

- OpenAI voice model release: https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/

## Related Documents

- [STT Engine Selection](stt-engine-selection.md)
- [Extension Realtime STT](../10_extension/realtime-stt.md)
- `sensitive-draft/50_strategy/revenue-model.md` (local-only, 커밋 제외)

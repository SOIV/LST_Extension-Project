# Extension Realtime STT

Status: planned

Chrome Extension에서 처리하는 실시간 STT 자막 기능을 다룬다.
Desktop App 없이 Extension 단독으로 사용할 수 있는 STT 경로를 포함한다.

## Scope

- Web Speech API 기반 STT
- OpenAI Realtime API 기반 스트리밍 STT
- OpenAI STT/Whisper 계열 API 기반 STT
- OpenAI Realtime Translate 경로에서 사용하는 input transcription 모델 구분
- 서버 제공 STT (Free/Pro 할당량)
- 사용자 API 키 기반 STT (OpenAI/Hugging Face/custom endpoint)
- 브라우저/탭 오디오 권한
- STT -> 번역 -> 오버레이 렌더링 파이프라인
- 지연시간 목표: 0.5~2초
- 사용자 설정 UI와 엔진 선택 연동

## Out of Scope

- Desktop App 또는 Lite Helper의 보조 STT 처리
- 시스템 전체 오디오 캡처
- GPU/CPU 모델 선택

## Engine Paths

| Path | Runs In | Notes |
|---|---|---|
| Web Speech API | Browser | 무료/무제한, 브라우저 의존 |
| OpenAI Realtime STT | OpenAI Realtime API | 낮은 지연의 스트리밍 전사 후보 |
| Server STT | LST server/API | 설정 없이 사용, 플랜/할당량 적용 |
| Own API Key STT | External provider | 사용자 OpenAI/Hugging Face/custom endpoint 사용 |
| Desktop Assisted STT | Lite Helper/Full Desktop App | Extension 단독 경로가 아니며 Desktop bridge 필요 |

## OpenAI Model Candidates

OpenAI 계열은 STT 단독 경로와 실시간 음성 번역 경로를 분리해서 본다.

| Model | Role | Recommended Use |
|---|---|---|
| `gpt-realtime-whisper` | Realtime STT | 실시간 방송 자막의 우선 후보 |
| `whisper-1` | STT | 기존 Whisper 호환 또는 fallback |
| `gpt-4o-transcribe` | Input transcription/STT | 번역 플로우의 원문 transcript 생성, 정확도 우선 |
| `gpt-4o-mini-transcribe` | Input transcription/STT | 번역 플로우의 원문 transcript 생성, 비용/속도 우선 |
| `gpt-4o-transcribe-diarize` | Input transcription/STT + diarization | 다중 화자 라디오/토크 방송 후보 |
| `gpt-realtime-translate` | Realtime speech translation | 음성 입력을 번역 자막으로 바로 연결하는 경로 |
| `gpt-realtime-2` | Realtime main model | Realtime 탭의 메인 처리 모델 후보 |

Dashboard 기준으로 `gpt-realtime-whisper`는 Realtime 탭의 user transcript model에 해당하고, `gpt-realtime-translate`는 Translate 탭의 translation model에 해당한다.
Translate 탭에서 `gpt-4o-transcribe` 계열을 input transcription model로 선택하는 경우, STT는 `gpt-4o-transcribe` 계열이 담당하고 번역은 `gpt-realtime-translate`가 담당한다.

## OpenAI Platform UI Notes

OpenAI Platform의 Create > Audio UI 기준으로는 Realtime 구성에서 다음처럼 선택지가 나뉜다.
이 내용은 UI 관찰값이며, 실제 API에서 반환되는 model id 목록은 `/v1/models` 또는 관련 API 문서에서 별도 확인이 필요하다.

| UI Field | Observed Options | Role |
|---|---|---|
| Model | `gpt-realtime-2`, `gpt-realtime-1.5`, `gpt-realtime` | Realtime 세션의 메인 모델 |
| User transcript model | `whisper-1`, `gpt-realtime-whisper`, `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize`, `gpt-4o-mini-transcribe` | 사용자 음성 입력을 transcript로 변환 |

따라서 LST 문서에서는 Realtime 메인 모델과 user transcript model을 분리해서 표기한다.
STT 단독 자막의 우선 후보는 `gpt-realtime-whisper`이고, `gpt-4o-transcribe` 계열은 Realtime 세션 또는 Translate 플로우의 input transcription 후보로 분류한다.

## OpenAI Path Split

### Realtime STT only

```text
audio
 -> gpt-realtime-whisper
 -> transcript
 -> overlay or translation pipeline
```

### Realtime speech translation

```text
audio
 -> gpt-4o-transcribe / gpt-4o-mini-transcribe / gpt-4o-transcribe-diarize
 -> transcript
 -> gpt-realtime-translate
 -> translated text
 -> overlay
```

## Realtime Policy

- 실시간 방송 자막은 `gpt-realtime-whisper`를 우선 검토한다.
- 번역까지 음성 단위로 바로 처리해야 하면 input transcription model과 `gpt-realtime-translate`를 조합하는 별도 경로로 검토한다.
- `gpt-4o-transcribe` 계열은 STT 모델이지만, Realtime Translate 플로우에서는 input transcription 단계에 배치한다.
- `gpt-4o-transcribe-diarize`는 다중 화자 콘텐츠에서 유용하지만, 지연시간과 Realtime 지원 범위를 별도 검증한다.
- `whisper-1`은 기존 호환/fallback 경로로 유지한다.

## Related Documents

- [STT Engine Selection](../40_shared-systems/stt-engine-selection.md)
- [Translation Pipeline](../40_shared-systems/translation-pipeline.md)
- [Desktop STT Runtime](../30_desktop-app/stt-runtime.md)
- [Overlay Renderer](overlay-renderer.md)

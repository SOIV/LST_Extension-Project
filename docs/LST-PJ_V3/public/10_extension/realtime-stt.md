# Extension Realtime STT

Status: planned

Chrome Extension에서 처리하는 실시간 STT 자막 기능을 다룬다.
Desktop App 없이 Extension 단독으로 사용할 수 있는 STT 경로를 포함한다.

## Scope

- Web Speech API 기반 STT
- OpenAI Realtime API 기반 스트리밍 STT
- OpenAI STT/Whisper 계열 API 기반 STT
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

| Model | Use |
|---|---|
| `gpt-realtime-whisper` | 실시간 스트리밍 전사 |
| `gpt-realtime-translate` | 실시간 음성 번역 |
| `gpt-4o-transcribe` | 정확도 우선 |
| `gpt-4o-mini-transcribe` | 비용/속도 우선 |
| `gpt-4o-transcribe-diarize` | 화자 분리 필요 시 |
| `whisper-1` | 기존 Whisper 호환 또는 fallback |

## Realtime Policy

- 실시간 방송 자막은 `gpt-realtime-whisper`를 우선 검토한다.
- 번역까지 음성 단위로 바로 처리해야 하면 `gpt-realtime-translate`를 별도 경로로 검토한다.
- `gpt-4o-transcribe` 계열은 파일 업로드 또는 짧은 청크 기반 전사에 적합한 후보로 분리한다.
- `whisper-1`은 기존 호환/fallback 경로로 유지한다.

## Related Documents

- [STT Engine Selection](../40_shared-systems/stt-engine-selection.md)
- [Translation Pipeline](../40_shared-systems/translation-pipeline.md)
- [Desktop STT Runtime](../30_desktop-app/stt-runtime.md)
- [Overlay Renderer](overlay-renderer.md)

---
sidebar_position: 5
---

# 엔진 선택 가이드

엔진은 확장 팝업의 **실시간** 탭에서 선택합니다.

---

## STT 엔진

### 엔진 비교

| 엔진 | 오디오 소스 | 비용 | 정확도 | 지연 | 키 필요 |
|---|---|---|---|---|---|
| Web Speech API | 마이크만 | 무료 | 보통 | 낮음 | 불필요 |
| OpenAI Whisper (Transcription API) | 탭 오디오 | 유료 | 높음 | 발화 후 처리 | OpenAI 키 |
| OpenAI Realtime API | 탭 오디오 | 유료 | 높음 | 낮음 (실시간) | OpenAI 키 |

### Web Speech API

브라우저 내장 음성 인식 기능입니다. 별도 STT API 키가 필요하지 않습니다.

- **오디오 소스**: 마이크 입력만 가능합니다. 탭 오디오(방송 소리)에는 사용할 수 없습니다.
- **언어 자동 감지**: Web Speech API는 언어 자동 감지를 지원하지 않습니다. 원본 언어를 명시적으로 설정해야 합니다. 자동 감지(auto)로 설정하면 경고가 표시됩니다.
- **브라우저 의존**: 인식 품질이 브라우저·OS·마이크 설정의 영향을 받습니다.
- **자막 방식**: 발화 단위가 아닌 실시간 스트리밍 방식으로 자막을 생성합니다.

### OpenAI Whisper (Transcription API)

발화 단위로 자막을 생성하는 안정적인 STT 엔진입니다.

- **오디오 소스**: 탭 오디오(방송 소리)를 직접 캡처합니다.
- **모델 선택**: `gpt-4o-mini-transcribe`(기본, 비용 우선)와 `gpt-4o-transcribe`(고품질) 중 선택할 수 있습니다.
- **자막 방식**: 발화가 끝난 후 결과를 처리하므로 Realtime보다 지연이 있을 수 있습니다.
- **OpenAI API 키 필요**: [API 키 설정](api-keys.md) 참고.

### OpenAI Realtime API

낮은 지연 시간이 필요할 때 사용합니다.

- **오디오 소스**: 탭 오디오를 캡처합니다.
- **자막 방식**: 발화 단위가 아닌 실시간 스트리밍 방식으로 자막을 생성합니다.
- **VAD(음성 감지) 조정 중**: 현재 무음 구간 처리와 중간 번역 표시가 세부 조정 중이어서 결과가 불안정할 수 있습니다.
- **OpenAI API 키 필요**: [API 키 설정](api-keys.md) 참고.

---

## 번역 엔진

### 엔진 비교

| 엔진 | 비용 | 강점 | 키 필요 |
|---|---|---|---|
| Google Translate (기본) | 무료 | 다국어 폭넓게 지원 | 불필요 |
| Google Apps Script | 무료 | 기본 Google보다 안정적 | Apps Script URL |
| Naver Papago | 제한적 무료 | 한·일·영 품질 우수 | NCP 키 |
| DeepL | 월 500,000자 무료 | 유럽어·영어 고품질 | DeepL 키 |

### Google Translate (기본)

별도 키 없이 바로 사용할 수 있는 기본 번역 엔진입니다. 다른 엔진 실패 시 자동 fallback으로도 동작합니다.

비공식 엔드포인트를 사용하므로, 요청이 많아지면 일시적으로 응답이 느려지거나 차단될 수 있습니다.

### Google Apps Script

사용자가 직접 배포한 Apps Script 웹 앱을 번역 프록시로 사용합니다. Google 계정의 번역 할당량을 사용하여 기본 엔진보다 안정적입니다.

배포 방법은 [API 키 설정](api-keys.md#google-apps-script-url) 문서를 참고하세요.

### Naver Papago

Naver Cloud Platform(NCP) 키가 필요합니다. 한국어·일본어·영어 번역 조합에서 자연스러운 결과를 보입니다.

NCP Client ID와 Client Secret 두 값이 모두 필요합니다. 발급 방법은 [API 키 설정](api-keys.md#papago-naver-cloud-platform-키) 문서를 참고하세요.

### DeepL

DeepL API 키가 필요합니다. 유럽어와 영어 번역에서 높은 품질을 제공합니다. Free 플랜으로 월 500,000자까지 무료입니다.

발급 방법은 [API 키 설정](api-keys.md#deepl-api-키) 문서를 참고하세요.

---

## 중간 번역 (Interim Translation)

실시간 탭의 **중간 번역** 옵션을 활성화하면 최종 결과(final)뿐 아니라 인식 중인 중간 결과(interim)에도 번역을 적용합니다.

- 처리 방식 : OpenAI Realtime API를 사용할 때 메인 변역에 사용량을 쓰지 않고 다른 변역 엔진을 사용하여 중간 변역을 처리하며 발화가 종료되어 다음으로 넘어 갔을 경우 메인 변역으로 한번더 변역처리하여 최종 결과로 반영합니다.
- 중간 번역은 번역 API 호출을 추가로 발생시키므로, 비용이 있는 엔진(Papago, DeepL)에서는 호출 횟수가 늘어납니다.
- 중간 번역 엔진을 별도로 지정하거나, 메인 번역 엔진과 같은 엔진(`동일`)을 사용할 수 있습니다.

:::tip
예시 방법으로 메인 변역을 DeepL 또는 Papago으로 설정하여 중간 변역에서는 Google Translate(무료/Script)을 사용해볼 수 있습니다.
:::

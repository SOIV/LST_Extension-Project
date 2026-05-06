# Desktop App 개발 문서 (Electron + Whisper 기반)

이 문서는 **Live Stream Translator – Desktop App 구성 요소, 아키텍처, 구현 상세, 기술 스택, 성능 기준**을 다루는 개발 문서입니다.
Chrome Extension과는 독립적으로 동작하지만, 필요 시 WebSocket을 통해 연동할 수 있습니다.

---

# 📌 1. Desktop App 목적

Desktop App은 Chrome Extension으로 처리하기 어려운 고급 기능을 제공하기 위한 보조 프로그램입니다.

### 주요 목적

* 시스템 전체 오디오 캡처(WASAPI Loopback / CoreAudio)
* Whisper 기반 온/오프라인 STT 모델 사용
* Chrome Extension보다 더 높은 정확도
* CPU/GPU 사용 옵션
* WebSocket을 통해 Extension에게 실시간 번역 결과 전달
* 스트리머/프로 방송용 환경 대응

---

# 🏗️ 2. 아키텍처 개요

```
[ELECTRON APP]
   ├── Audio Engine (WASAPI)
   ├── STT Engine (Web Speech API/Whisper)
   ├── Translation Engine (Papago/DeepL/Google)
   ├── WebSocket Server
   ├── Settings & Profiles
   └── IPC (Renderer <-> Main)
```

---

# 🧩 3. 주요 모듈 구성

## ✔ 3-1. Main Process

* Window 생성
* Whisper 엔진 로딩
* 오디오 캡처 시작/중지 제어
* 번역 API 호출 요청 처리
* WebSocket 서버 운영
* 설정 저장/불러오기

## ✔ 3-2. Renderer(UI)

* React/Tailwind 기반 UI
* 실시간 로그 표시(STT, 번역 결과)
* 모델 선택
* 오디오 장치 선택
* WebSocket 연결 상태 표시

## ✔ 3-3. Audio Capture Engine

지원 방식:

* Windows: WASAPI Loopback
* macOS: CoreAudio + 가상 장치 필요(BlackHole 권장)

출력:

* 16-bit PCM / 48kHz / mono 변환

## ✔ 3-4. Whisper Engine

Whisper.cpp 또는 faster-whisper 선택 가능.

지원 모델:

* tiny
* base
* small
* medium (선택)

GPU 가속 지원:

* NVIDIA CUDA
* AMD ROCm(선택)
* CPU only 모드

## ✔ 3-5. Translator

* Naver Papago API
* Google Translate API
* DeepL API

캐싱:

* 동일 문장 단위 반복 시 1초 미만 응답

## ✔ 3-6. WebSocket Server

Chrome Extension 또는 로컬 앱과 연결

이벤트 흐름:

```
client → ws://localhost:48000 → server
server → "translated-text" 이벤트로 전송
```

---

# ⚙️ 4. 개발 스택

* **Electron 30+ (Chrome 128, Node 20)**
* **React + Vite**
* **TypeScript**
* **Whisper.cpp / Faster-Whisper**
* **WASAPI Loopback**
* **Electron-Builder 패키징**

---

# 📡 5. 데이터 흐름

```
         ┌──────────────┐
         │ System Audio │
         └──────┬───────┘
                ▼
     ┌──────────────────────┐
     │ Audio Capture Engine │
     └──────┬───────────────┘
            ▼
     ┌──────────────────────┐
     │     Whisper STT      │
     └──────┬───────────────┘
            ▼
   ┌──────────────────────────┐
   │ Translator (Papago/…)    │
   └──────────┬───────────────┘
              ▼
   ┌──────────────────────────┐
   │ WebSocket → Extension    │
   └──────────────────────────┘
```

---

# 📁 6. 설정 구조

`config.json` 저장:

```json
{
  "audioDevice": "default",
  "whisperModel": "small",
  "translateEngine": "papago",
  "targetLang": "ja",
  "wsPort": 48000,
  "gpu": false
}
```

---

# 🧪 7. 성능 기준

| 환경       | 모델           | 평균 지연      | CPU 사용률 |
| -------- | ------------ | ---------- | ------- |
| i5-12400 | tiny         | 300~500ms  | 25%     |
| i5-12400 | small        | 900~1400ms | 60%     |
| RTX 3060 | small (CUDA) | 300~500ms  | 10%     |
| M1 Pro   | small        | 500~800ms  | 25%     |

권장:

* **tiny/base → 실시간 번역 집중**
* **small 이상 → 정확도 중시**

---

# 🪟 8. UI 구성

UI는 4개의 탭 구조로 구성:

### ✔ Dashboard

* 실시간 텍스트 로그
* 언어 감지/번역 결과

### ✔ Audio

* 오디오 장치 선택
* 샘플링레이트 정보
* 캡처 시작/중지 버튼

### ✔ STT Model

* Whisper 모델 선택
* 모델 다운로드/적재 상태 표시

### ✔ Integration

* WebSocket 포트 설정
* Extension 연결 상태 표시

---

# 🔌 9. Chrome Extension 연동

Extension과 WebSocket 연결 시 데이터 전달 구조:

```
{ "type": "stt", "text": "hello" }
{ "type": "translated", "text": "こんにちは" }
```

Extension은 Overlay에 바로 렌더링.

---

# 🧷 10. 예외 처리

* 오디오 장치 없음 → 자동 재검색
* Whisper 로드 실패 → tiny fallback
* 번역 API 실패 → 1회 재시도 후 패스
* WebSocket 연결 끊김 → 재연결 3초 간격

---

# 🔐 11. 보안

* API 키는 OS Keychain 또는 로컬 암호화 저장
* WebSocket은 로컬 호스트에서만 실행
* Electron에서 remote module 금지

---

# 📌 12. 빌드 및 배포

### Windows

* NSIS 설치 파일
* portable zip

### macOS

* dmg
* notarization 필요

---

# ✔ 13. 추가 개발 계획

* GPU 자동 감지 및 Whisper 가속 옵션 추천
* 번역 품질 평가 기능
* 사전 기반 커스텀 번역
* Extension 자동 연동 모드

---

# 📝 마무리

이 문서는 **Desktop App의 구조와 실제 개발 구현에 필요한 세부 요소**를 모두 포함한 개발자용 문서입니다.
필요하면 코드 구조, 폴더링, 클래스 설계, 시퀀스 다이어그램도 추가 가능.

---

# 🧩 추가: 클래스 설계 · 시퀀스 다이어그램 · API 설계

아래 항목들은 요청하신 "코드 구조 / 예시 코드 제외" 조건을 반영하여 **구조 설계(클래스/모듈 레벨)**, **시퀀스(흐름)**, **내부/외부 통신 프로토콜(메시지/엔드포인트)**을 문서화한 내용입니다.

## 1) 클래스/모듈 설계 (책임 중심)

아래는 Extension 핵심 컴포넌트의 논리적 클래스·모듈 설계도입니다. 각 모듈은 단일 책임 원칙(SRP)을 따릅니다.

### 1-1. BackgroundService

* 책임: 탭 캡처 제어, Offscreen 문서 관리, 전역 상태 관리, Extension 아이콘/액션 응답
* 주요 메서드(개념적): `startCapture(tabId)`, `stopCapture(tabId)`, `createOffscreen(tabId)`, `broadcastMessage(payload)`
* 상태: activeCaptures: Map<tabId, CaptureMetadata>

### 1-2. OffscreenWorker

* 책임: tabCapture 직접 호출(Manifest V3 제약 우회), MediaStream -> 포맷 변환(필요 시) 그리고 Content Script로 스트림 식별자 전송
* 입력/출력: background에서 메시지 수신 → 캡처 시작/중지 → streamId 반환

### 1-3. ContentController

* 책임: 페이지 내에서 오버레이/DOM 관리, STT 시작/정지, 번역 결과 렌더링
* 서브모듈: OverlayManager, STTManager, TranslatorManager, CacheManager

### 1-4. OverlayManager

* 책임: 자막 DOM 생성/애니메이션/포지셔닝/반응형 처리
* API(개념적): `showInterim(text)`, `showFinal(orig, translated)`, `setPosition(config)`

### 1-5. STTManager

* 책임: Web Speech API 및 다른 STT 엔진 추상화 레이어, 인식 이벤트 파싱
* 이벤트: `onInterim(text)`, `onFinal(text)`, `onError(err)`
* 정책: 자동 재시작 로직, 타임아웃 및 silence 감지

### 1-6. TranslatorManager

* 책임: 다중 번역 엔진(fallback 포함) 연동, 번역 캐시 로직
* 정책: LRU 캐시, batching(필요 시), 엔진 전환 우선순위

### 1-7. CacheManager

* 책임: 메모리 캐시 + IndexedDB(영속성) 관리
* 구조: LRU in-memory + IndexedDB 백업, TTL 정책

### 1-8. SettingsManager

* 책임: chrome.storage 접근 추상화, 동기화 및 로컬 암호화(민감값)
* 키 예시: `settings:{targetLang, sourceLang, engineOrder, apiKeysEncrypted}`

### 1-9. Telemetry/Logger

* 책임: 에러/성능 로그 수집(사용자 허용 시 익명), Sentry 연동 가능
* 이벤트 예시: `stt_error`, `translation_latency`, `capture_start` (익명화)

---

## 2) 시퀀스 다이어그램 (텍스트 흐름)

아래는 핵심 시나리오인 **사용자가 확장 아이콘을 눌러 자막을 시작**했을 때의 흐름입니다.

1. 사용자가 Extension 아이콘 클릭
2. BackgroundService receives click → `startCapture(tabId)` 호출
3. BackgroundService → OffscreenWorker에게 `startTabCapture(tabId)` 메시지 전송
4. OffscreenWorker tabCapture API로 MediaStream 획득 → streamId 생성
5. OffscreenWorker 응답으로 `streamId`를 BackgroundService에 반환
6. BackgroundService → 해당 탭의 ContentController에 `AUDIO_STREAM_AVAILABLE(streamId)` 메시지 전송
7. ContentController가 AudioContext 연결 및 STTManager 초기화
8. STTManager가 Web Speech API로 음성 인식 시작 → interim 결과 이벤트 전송
9. ContentController OverlayManager로 interim 출력(원문)
10. STTManager가 final 결과 수신 시 TranslatorManager에 텍스트 전송
11. TranslatorManager가 캐시 확인 후, 필요 시 번역 API 호출
12. 번역 결과를 ContentController에 반환 → OverlayManager가 원문+번역 렌더
13. 사용자가 중지 또는 탭 종료 → BackgroundService/OffscreenWorker에서 리소스 정리

> 참고: Desktop App(연동 모드)일 경우 STTManager 대신 WebSocket을 통해 로컬 Whisper로 전송 후 결과 수신(10~12단계 대체)

---

## 3) 내부 메시지/이벤트 프로토콜 (Background <-> Content <-> Offscreen)

메시지 교환 표준을 규정하면 디버깅/확장성이 좋아짐.

### 공통 메시지 구조 (JSON)

```json
{
  "type": "STRING",    // e.g. AUDIO_STREAM_AVAILABLE, STT_INTERIM, STT_FINAL, TRANSLATION_RESULT, ERROR
  "tabId": 123,
  "timestamp": 1690000000000,
  "payload": { }
}
```

### 주요 메시지 타입

* `START_CAPTURE` { tabId }
* `STOP_CAPTURE` { tabId }
* `AUDIO_STREAM_AVAILABLE` { streamId }
* `STT_INTERIM` { text }
* `STT_FINAL` { text }
* `TRANSLATION_REQUEST` { text, sourceLang, targetLang }
* `TRANSLATION_RESULT` { original, translated, engine }
* `ERROR` { code, message }

### 예시 흐름

* background -> content: `{ type: 'AUDIO_STREAM_AVAILABLE', payload: { streamId } }`
* content -> background: `{ type: 'CAPTURE_STATUS', payload: { status: 'started' } }`
* content -> background: `{ type: 'TELEMETRY', payload: { event: 'translation_latency', value: 320 } }`

---

## 4) Extension ↔ Desktop App (WebSocket) 연동 규격

Desktop App이 로컬에서 STT 또는 추가 번역을 수행할 때 사용되는 메시지 규약입니다.

### WS 연결 정보

* 기본 포트: `ws://localhost:48000` (설정 가능)
* 인증: 로컬이므로 기본적으로 인증 생략하되, 필요 시 토큰 기반 간단 인증 가능

### WS 메시지 포맷

* 클라이언트 -> 서버 (Extension이 보냄)

```json
{ "type": "stt_request", "id": "uuid", "audio_chunk_base64": "...", "seq": 1 }
```

* 서버 -> 클라이언트 (Desktop App이 보냄)

```json
{ "type": "stt_response", "id": "uuid", "text": "...", "is_final": true }
```

* 번역 요청

```json
{ "type": "translate", "id": "uuid", "text": "...", "target": "ko" }
```

* 번역 응답

```json
{ "type": "translate_result", "id": "uuid", "translated": "..." }
```

### 연결 정책

* 네트워크 오류 시 자동 재시도(지수백오프, 최대 5회)
* 연결 시 처음에 `capabilities` 메시지 교환(예: whisper_available, supported_models)

---

## 5) 저장(storing) 스키마 (chrome.storage)

아래 키/값 스키마를 권장합니다.

* `settings` (object)

  * `sourceLang`: string (ex. 'auto')
  * `targetLang`: string (ex. 'ko')
  * `engineOrder`: array (['papago','google','deepl'])
  * `overlayConfig`: object { position: 'bottom', fontSize: 22 }
  * `cacheTTL`: number (seconds)
* `apiKeys` (object, 암호화 권장)

  * `papago`: encrypted string
  * `deepl`: encrypted string
* `history` (array) — 최근 번역 히스토리(옵션, 길이 제한 100)
* `telemetryOptIn`: boolean

**권장 저장 방법**: 민감 정보(`apiKeys`)는 `chrome.storage.local`에 두되, 반드시 암호화(클라이언트 측) 적용.

---

## 6) 모니터링 및 로깅 전략

서비스 안정성 확보를 위해 최소한의 로깅/모니터링을 포함하세요.

### 로깅 레벨

* DEBUG: 개발 중 상세 로그(비활성화 기본)
* INFO: 사용자 이벤트(캡처 시작/정지)
* WARN: 복구 가능한 문제
* ERROR: 사용자 영향 문제

### 전송 정책

* 익명화된 메트릭만 수집(사용자 동의 필요)
* 예시: `translation_latency`, `stt_error_count`, `avg_memory_mb`
* 전송 주기: 하루 1회 혹은 세션 종료 시 집계 전송

### 외부 도구

* Sentry (에러 트래킹)
* Google Analytics / Plausible 대안 (사용자 추적 시 동의 필요)

---

## 7) 테스트 전략 (테스트 케이스 템플릿)

자동화 + 수동 테스트 병행.

### 유닛 테스트(권장)

* SettingsManager: 설정 저장/읽기 테스트
* CacheManager: LRU 만료 동작
* TranslatorManager: 캐시 히트/미스 테스트

### 통합/엔드투엔드

* Background -> Offscreen -> Content 전체 플로우 시뮬레이션
* STT 중단/재시작 상황 복원
* 번역 API 장애(fallback) 시나리오

### 수동 체크리스트

* 권한 거부 시 사용자 메시지 노출 확인
* 탭 전환/ 새 탭에서 정상 동작
* 확장 종료 후 리소스 정리

---

## 8) CI/CD 및 릴리즈 체크리스트

* [ ] Manifest 버전/권한 최종 검토
* [ ] 개인정보 처리방침 최신화
* [ ] API Key 노출 확인(노출 금지)
* [ ] 빌드 산출물 검사 (크기, sourcemap 포함 여부)
* [ ] 자동화 테스트(유닛/통합) 통과
* [ ] Chrome Web Store 스크린샷 및 설명 준비

---

## 9) 디버깅 팁 (운영/개발)

* Service Worker 로그: chrome://extensions → Service Worker Inspect 사용
* Offscreen 로그: Offscreen Document에 콘솔 연결하여 검사
* MediaStream 문제: AudioContext와 destination 연결 확인
* 권한 문제: chrome.permissions.contains / request 사용
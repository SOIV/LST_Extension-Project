# Live Stream Translator – 프로젝트 개요 문서 (Overview)

이 문서는 **Chrome Extension / Desktop App을 포함한 전체 시스템의 개념·구조·로드맵·기술 방향을 정리한 상위 문서**입니다.

구체적인 기술 구현 문서(Extension / Desktop App)는 별도의 파일로 분리하여 관리합니다.

---

## 📌 1. 프로젝트 목표

여러 스트리밍 플랫폼(YouTube, Twitch, SOOP, 치지직, 니코니코동화 등)의 **실시간 음성을 인식(STT) → 번역(TTT) → 자막 표시**를 자동화하는 시스템.

주요 목표:
- 다중 플랫폼 지원
- 실시간 번역(0.5~2초)
- Chrome Extension 단독으로 90% 사용자 커버
- Desktop App은 고급 기능(10% 사용자)
- 모듈식 설계
- 경량, 유지보수 쉬운 구조

---

## 🏗️ 2. 전체 아키텍처

### ✔ Chrome Extension 중심 구조 (권장 90%)
- tabCapture API로 탭 오디오 획득
- Web Speech API 또는 클라우드 STT 사용
- 번역(Papago/DeepL/Google)
- 자막 UI Overlay
- IndexedDB 기반 캐싱

### ✔ Desktop App 포함 구조 (고급 사용자 10%)
- Electron 기반 오디오 캡처(WASAPI/CoreAudio)
- Whisper 오프라인 STT
- WebSocket으로 Extension과 연동

### ✔ 데이터 흐름
```
[Audio] → [Capture] → [STT] → [Translated Text] → [Overlay UI]
```

---

## 📦 3. 주요 구성 요소

### 3-1. Chrome Extension 구성 요소
- Service Worker (tabCapture 관리)
- Content Script (STT, 번역, UI 렌더링)
- Popup (설정 UI)
- Offscreen Document (MV3 제약 해결)
- 캐싱(메모리 + IndexedDB)

### 3-2. Desktop App 구성 요소
- 오디오 캡처 엔진
- Whisper 모델(tiny/base/small)
- WebSocket 서버
- Extension과 통신 모듈

---

## 🌍 4. 플랫폼 지원 전략

각 플랫폼의 구조와 UI 위치 요소가 다르므로 플랫폼별 전략 필요.

### YouTube / Live
- YouTube 자막 API 우선 사용 (정확도 95%+)
- 콘텐츠 구조 안정적

### Twitch
- 초저지연 대응
- 화면 오버레이 위치 조정 필요

### SOOP, 치지직
- 한국어 기반 플랫폼
- 속어 필터/사전 유용

### 니코니코동화
- 일본어 기반 + 흐르는 코멘트
- 일본어 속어 사전 필요

---

## 🚀 5. 개발 로드맵

### Phase 1 – Chrome Extension MVP
- YouTube Live 지원
- Web Speech API STT
- Papago 번역
- 기본 Overlay UI

### Phase 2 – 번역·UX 개선
- 캐싱
- DeepL/Google 추가
- 설정 UI

### Phase 3 – 플랫폼 확장
- Twitch, SOOP, 치지직, 니코니코 지원
- 플랫폼별 속어 사전

### Phase 4 – 고급 기능
- 히스토리
- 용어집
- 피드백
- Cloud STT 옵션

### Phase 5 – Desktop App
- Whisper 온/오프라인 STT
- 시스템 오디오 캡처
- Extension 연동

---

## 📊 6. 성능 목표

- 지연시간: 0.5~2초
- STT 정확도: Web Speech 80~90%, Whisper 90~95%
- Extension 용량: 2~5MB
- 메모리 사용: 30~50MB

---

## 🔐 7. 보안 및 개인정보 보호

- 번역 결과를 서버에 저장하지 않음
- API 키는 로컬 저장 및 암호화 가능
- Chrome Web Store 정책 준수

---

## 📚 8. 문서 구성 (전체 구조)
이 프로젝트 문서는 아래 3종으로 구성됩니다.

### ✔ overview.md ← **현재 문서**
전체 시스템 개념 / 아키텍처 / 로드맵 / 플랫폼 전략

### ✔ extension.md
Chrome Extension 개발 상세 문서
- Manifest
- tabCapture
- STT/번역/Overlay 구현
- 성능 최적화
- 에러 처리

### ✔ desktop-app.md
Desktop App 상세 문서 (Whisper 기반)
- Electron 운영 구조
- 시스템 오디오 캡처
- Whisper 모델
- WebSocket 연동

### ✔ subtitle_features.md
실험적 아이디어들을 정리하는 문서

---

## 📝 마지막 노트
이 문서는 전체 프로젝트의 "상위 설계" 문서입니다.  
개발 및 유지보수를 위한 실제 구현 상세 문서는 extension.md / desktop-app.md에 분리하여 작성합니다.
# 라이브 스트림 통합 번역 시스템 (Live Stream Translator)

## 📋 프로젝트 개요

### 목적
YouTube, Twitch, SOOP, 치지직, 니코니코동화 등 주요 라이브 스트리밍 플랫폼에서 실시간으로 음성을 인식하고 번역하여 자막으로 표시하는 통합 시스템 개발

### 핵심 특징
- 🎯 **다중 플랫폼 지원**: 6개 이상의 주요 스트리밍 플랫폼
- ⚡ **실시간 처리**: 0.5-2초 이내 지연시간
- 🔧 **모듈식 설계**: 필요한 기능만 선택 설치
- 💻 **Chrome Extension 우선**: 대부분의 경우 Extension만으로 충분
- 💾 **경량화**: Extension 기본 2-5MB, Desktop App은 선택사항

---

## 🏗️ 시스템 아키텍처

### ⭐ Chrome Extension 단독 구조 (권장 - 90% 사용자)

```
┌──────────────────────────────────────────┐
│          Chrome Extension                 │
├──────────────────────────────────────────┤
│  • Platform Detector                      │
│  • chrome.tabCapture API (오디오 캡처)    │
│  • Web Speech API / Cloud STT             │
│  • Translation Engine (Papago/DeepL)      │
│  • UI Overlay Manager                     │
│  • Translation Cache (IndexedDB)          │
└──────────────────────────────────────────┘
           ↓
[Browser Tab Audio] → [STT] → [Translation] → [Subtitle Overlay]
```

**장점:**
- ✅ 설치 간편 (Chrome Web Store 원클릭)
- ✅ 크로스 플랫폼 (Windows/Mac/Linux 동일)
- ✅ 경량 (2-5MB)
- ✅ 개발 빠름 (웹 기술만 사용)
- ✅ 자동 업데이트
- ✅ 유지보수 쉬움

**제약:**
- ⚠️ 브라우저 내 오디오만 캡처 가능
- ⚠️ 인터넷 연결 필요 (Cloud STT 사용 시)
- ⚠️ Web Speech API 정확도 80-90%

### 🔧 하이브리드 구조 (Desktop App 옵션 - 10% 고급 사용자)

```
┌──────────────────────────────────────────┐
│          Chrome Extension                 │
├──────────────────────────────────────────┤
│  • Platform Detector                      │
│  • chrome.tabCapture (기본 오디오 캡처)   │
│  • YouTube API Handler                    │
│  • UI Overlay Manager                     │
│  • Translation Cache                      │
└────────────┬─────────────────────────────┘
             │
             ├── 기본: tabCapture API
             │   ↓
             │   Web Speech API / Cloud STT
             │
             ├── 고급: Desktop App 연동 (선택)
             │   ↓
┌────────────┴─────────────────────────────┐
│     Desktop Application (선택사항)        │
├──────────────────────────────────────────┤
│  • System Audio Capture (OBS/WASAPI)      │
│  • Whisper (오프라인 STT, 90-95% 정확도)  │
│  • WebSocket Server (:8777)               │
│  • Process-specific Capture               │
└──────────────────────────────────────────┘
```

**Desktop App이 필요한 경우:**
- OBS 등 데스크톱 앱의 오디오 캡처
- 오프라인 환경 (네트워크 없이)
- 최고 정확도 필요 (Whisper 90-95%)
- 시스템 전체 오디오 캡처
- 프라이버시 중요 (API 서버 없이)

### 데이터 플로우

```
[Audio Stream] → [Capture] → [STT] → [Text] → [Translation] → [Display]
                    ↓           ↓        ↓          ↓            ↓
                tabCapture  WebSpeech Cache    Papago/DeepL   Overlay
```

---

## 🌟 Chrome Extension 단독 구현 가이드 (핵심)

### 왜 Extension만으로 가능한가?

**chrome.tabCapture API의 핵심 기능:**
- 현재 탭의 오디오/비디오를 MediaStream으로 직접 캡처
- 브라우저 네이티브 API라서 외부 프로그램 불필요
- AMA Music 같은 음악 인식 앱도 이 방식 사용

**작동 원리:**
1. 사용자가 Extension 아이콘 클릭
2. chrome.tabCapture로 탭 오디오 스트림 획득
3. Web Speech API로 실시간 음성→텍스트 변환
4. Google(Public, Script)/Papago/DeepL/Gemini/Custom API로 번역(주 사용은 Google(Public, Script)/Papago를 사용)
5. Content Script로 비디오 위에 자막 오버레이

### 구현해야 할 핵심 컴포넌트

#### UI 오버레이
```
"비디오 플레이어 위에 자막 오버레이를 표시하는 방법을 설계해줘.

요구사항:
- 원문과 번역문을 함께 표시
- 플랫폼(YouTube, Twitch 등)에 따라 위치 자동 조정
- 배경을 반투명 검정색 + backdrop blur
- 자막이 최종 확정되면 3초 후 페이드아웃
- z-index를 높게 설정하되 클릭 방지 (pointer-events)
- 반응형 디자인 (모바일 대응)"
```

#### 플랫폼 감지
```
"YouTube, Twitch, SOOP, 치지직, 니코니코동화를 자동으로 감지하는 시스템을 설계해줘.

감지 방법:
- URL 패턴 매칭
- DOM 선택자 확인
- 라이브 스트리밍 여부 확인

각 플랫폼별로:
- 고유 식별자
- 최적 설정값 (언어, 버퍼 크기)
- UI 위치 조정값
- 특수 기능 (속어 사전 등)"
```

#### 설정 UI
```
"Chrome Extension의 Popup UI를 설계해줘.

포함할 기능:
- 언어 선택 (원본/번역)
- 번역 엔진 선택 (Papago/DeepL/Google)
- API 키 입력 (각 서비스별)
- 표시 옵션 (원문 표시 여부, 위치, 크기)
- 현재 캡처 상태 표시
- 사용 통계 (API 할당량)

저장 방식: chrome.storage.sync
디자인: Material Design 스타일"
```

#### 성능 최적화
```
"Chrome Extension의 성능을 최적화하는 방법을 알려줘.

최적화 영역:
1. 메모리 관리
   - 캐시 크기 제한
   - 주기적 정리
   - MediaStream/AudioContext 정리
   
2. 네트워크 최적화
   - 번역 요청 batching
   - 중복 요청 dedupe
   - API 호출 최소화
   
3. 렌더링 최적화
   - 불필요한 DOM 업데이트 방지
   - CSS transform 사용
   - 애니메이션 최적화"
```

#### 에러 처리
```
"Chrome Extension에서 발생할 수 있는 에러와 처리 방법을 알려줘.

주요 에러 시나리오:
1. 오디오 캡처 실패
   - 권한 거부
   - 플랫폼 미지원
   
2. STT 실패
   - 네트워크 에러
   - 음성 없음
   - 타임아웃
   
3. 번역 API 에러
   - 할당량 초과
   - 인증 실패
   - 네트워크 에러
   
4. 메모리 부족

각 에러별 처리 전략과 사용자 알림 방법을 설명해줘."
```

### Desktop App 개발 프롬프트 (선택사항)

#### 시스템 오디오 캡처
```
"Electron 앱에서 시스템 오디오를 캡처하는 방법을 설명해줘.

플랫폼별 구현:
- Windows: WASAPI Loopback
- macOS: Core Audio + BlackHole
- Linux: PulseAudio

요구사항:
- 특정 프로세스(chrome.exe)만 선택 캡처
- 16kHz 모노 오디오로 변환
- 실시간 스트리밍"
```

#### Whisper 통합
```
"Electron 앱에서 OpenAI Whisper를 사용해 오프라인 STT를 구현하는 방법을 알려줘.

요구사항:
- whisper.cpp 바인딩 사용
- 오디오 버퍼를 실시간으로 처리
- 모델 크기(tiny/base/small) 선택 가능
- GPU 가속 옵션
- 메모리 최적화"
```

#### WebSocket 서버
```
"Electron 앱 내부에 WebSocket 서버를 만들어서
Chrome Extension과 통신하는 구조를 설계해줘.

기능:
- 오디오 스트림 수신
- STT 처리 후 결과 반환
- 연결 상태 모니터링
- 자동 재연결
- 에러 처리"
```

### 코드 리뷰 요청
```
"[작성한 코드를 첨부하고]

이 Chrome Extension 코드를 리뷰해줘.

점검 항목:
1. 성능
   - 메모리 누수 가능성
   - 불필요한 재렌더링
   - 비효율적인 API 호출
   
2. 보안
   - XSS 취약점
   - API 키 노출
   - 권한 과다 요청
   
3. 사용자 경험
   - 로딩 상태 표시
   - 에러 메시지 명확성
   - 직관적인 UI
   
4. 코드 품질
   - Chrome Extension 모범 사례
   - 에러 처리 완전성
   - 코드 구조 개선점"
```

### 디버깅 도움
```
"[에러 상황 설명]

문제 상황:
- chrome.tabCapture 사용 시 오디오가 음소거됨
- AudioContext로 재생을 시도했는데도 소리가 안 들림

환경:
- Chrome 버전: 120
- Manifest V3
- Windows 11

[에러 로그 첨부]

원인과 해결 방법을 단계별로 알려줘."
```

### 기능 확장
```
"현재 Extension에 다음 기능을 추가하고 싶어:

1. 번역 히스토리 저장
   - 최근 100개 저장
   - 검색 기능
   - 내보내기 (JSON/CSV)
   
2. 자주 나오는 문장 자동 학습
   - 빈도 분석
   - 자동 완성 제안
   
3. 스트리머별 커스텀 용어집
   - 용어 등록/편집
   - 자동 적용
   
4. 번역 품질 피드백
   - 👍/👎 버튼
   - 대안 번역 제안
   - 학습 데이터로 활용

기존 코드 구조를 유지하면서 이 기능들을 추가하는 방법과
필요한 데이터 구조를 설계해줘."
```

---

## 🎯 Chrome Extension vs Desktop App 비교

### 상세 비교표

| 항목 | Chrome Extension | Desktop App |
|------|------------------|-------------|
| **설치 난이도** | ⭐⭐⭐⭐⭐ 원클릭 설치 | ⭐⭐ OS별 설치 파일 |
| **용량** | ⭐⭐⭐⭐⭐ 2-5MB | ⭐⭐ 100-200MB |
| **개발 속도** | ⭐⭐⭐⭐⭐ 1-2주 | ⭐⭐⭐ 3-4주 |
| **개발 기술** | ⭐⭐⭐⭐⭐ 웹 기술만 | ⭐⭐ 네이티브 모듈 필요 |
| **유지보수** | ⭐⭐⭐⭐⭐ 자동 업데이트 | ⭐⭐⭐ 수동 배포 |
| **크로스 플랫폼** | ⭐⭐⭐⭐⭐ 코드 1벌 | ⭐⭐⭐ OS별 빌드 |
| **성능** | ⭐⭐⭐⭐ 충분함 | ⭐⭐⭐⭐⭐ 최고 |
| **STT 정확도** | ⭐⭐⭐⭐ 80-90% | ⭐⭐⭐⭐⭐ 90-95% |
| **오프라인** | ⭐⭐ 제한적 | ⭐⭐⭐⭐⭐ 완전 지원 |
| **사용 범위** | 브라우저만 | 시스템 전체 |
| **비용** | 무료 (API 키만) | 무료 (리소스 사용 많음) |

### 권장 시나리오

#### ✅ Chrome Extension만으로 충분한 경우 (90% 사용자)
1. **YouTube, Twitch 등 브라우저 기반 스트리밍 시청**
   - 가장 일반적인 사용 사례
   - tabCapture로 완벽히 처리 가능

2. **인터넷 연결 환경**
   - Web Speech API 사용
   - Cloud 번역 API 사용

3. **빠른 배포와 업데이트 필요**
   - Chrome Web Store 자동 업데이트
   - 버그 수정 즉시 반영

4. **다양한 OS 지원**
   - Windows/Mac/Linux 동일 코드
   - 별도 빌드 불필요

5. **개발 리소스 제한**
   - 웹 개발자만으로 가능
   - 네이티브 개발 불필요

#### 💡 Desktop App이 필요한 경우 (10% 고급 사용자)

1. **OBS 등 데스크톱 앱의 오디오 캡처**
   - 브라우저 외부 앱
   - 시스템 전체 오디오 필요

2. **오프라인 환경 사용**
   - 네트워크 없는 환경
   - Whisper 로컬 실행

3. **최고 정확도 필요**
   - 전문적 용도 (회의, 강의)
   - Whisper 90-95% 정확도

4. **프라이버시가 매우 중요**
   - API 서버 전송 꺼림
   - 완전 로컬 처리

5. **시스템 전체 오디오 캡처**
   - 여러 앱 동시 번역
   - Discord + 게임 등

### 하이브리드 전략 (권장 개발 순서)

```
┌─────────────────────────────────────────┐
│         개발 1단계 (1-2주)               │
│                                          │
│  Chrome Extension 개발                   │
│  - 기본 기능 완성                        │
│  - 90% 사용자 커버                       │
│  - MVP 검증                              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         테스트 & 피드백 (1-2주)          │
│                                          │
│  - 사용자 피드백 수집                    │
│  - 버그 수정                             │
│  - 실제 수요 파악                        │
└─────────────────────────────────────────┘
                    ↓
      고급 기능 수요가 있는가?
                    ↓
           Yes (10%) │ No (90%)
                    ↓
┌─────────────────────────────────────────┐
│         개발 2단계 (3주) - 선택          │
│                                          │
│  Desktop App 개발                        │
│  - Extension과 연동                      │
│  - 고급 사용자 지원                      │
│  - 추가 기능 제공                        │
└─────────────────────────────────────────┘
```

**핵심 전략:**
- Extension 먼저 완성하고 출시
- 사용자 반응 보고 Desktop App 필요성 판단
- 대부분의 사용자는 Extension만으로 만족
- Desktop App은 유료 옵션으로 제공 가능

---

## 📚 참고 자료

### Chrome Extension 개발
- **[Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)** - 공식 문서
- **[chrome.tabCapture API](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)** - 오디오 캡처
- **[Audio recording and screen capture](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture)** - 가이드
- **[Offscreen Documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen)** - Manifest V3 우회

### Web API
- **[Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)** - 음성 인식
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)** - 오디오 처리
- **[MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_API)** - 스트림 관리

### STT & Translation API
- **[OpenAI Whisper](https://github.com/openai/whisper)** - 오픈소스 STT
- **[Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text/docs)** - Cloud STT
- **[Papago API](https://developers.naver.com/docs/papago/)** - 네이버 번역
- **[DeepL API](https://www.deepl.com/docs-api)** - 고품질 번역
- **[Google Cloud Translation](https://cloud.google.com/translate/docs)** - 구글 번역

### Desktop App 개발 (선택사항)
- **[Electron](https://www.electronjs.org/)** - 크로스 플랫폼 앱
- **[OBS Studio Source](https://github.com/obsproject/obs-studio)** - 오디오 캡처
- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** - Whisper C++ 구현
- **[node-record-lpcm16](https://github.com/gillesdemey/node-record-lpcm16)** - Node.js 오디오 녹음

### 실제 구현 예시
- **[Chrome Audio Capture Extension](https://github.com/teamplanes/audio-capture-extension)** - 오픈소스 예제
- **[Speech Recognition Example](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)** - MDN 예제
- **[Live Caption (Windows 11)](https://support.microsoft.com/en-us/windows/use-live-captions-to-better-understand-audio)** - MS 공식 기능

### 커뮤니티 & 지원
- **[Chrome Extension Google Group](https://groups.google.com/a/chromium.org/g/chromium-extensions)** - 공식 포럼
- **[Stack Overflow - Chrome Extension](https://stackoverflow.com/questions/tagged/google-chrome-extension)** - Q&A
- **[Reddit r/chrome_extensions](https://www.reddit.com/r/chrome_extensions/)** - 커뮤니티

---

## 🤝 기여 가이드

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/yourusername/live-stream-translator.git
cd live-stream-translator

# Chrome Extension 개발
cd extension
npm install
npm run dev

# Chrome에서 Extension 로드
# 1. chrome://extensions/ 접속
# 2. "개발자 모드" 활성화
# 3. "압축해제된 확장 프로그램을 로드합니다" 클릭
# 4. extension/dist 폴더 선택

# Desktop App 개발 (선택사항)
cd desktop
npm install
npm run electron:dev

# 빌드
npm run build
npm run build:chrome  # Chrome Web Store용
npm run build:firefox # Firefox 애드온용
npm run build:edge    # Edge 애드온용
```

### 프로젝트 구조

```
live-stream-translator/
├── extension/                # Chrome Extension
│   ├── manifest.json        # Extension 설정
│   ├── background.js        # Service Worker
│   ├── content.js          # 메인 로직
│   ├── popup.html/js       # 설정 UI
│   ├── offscreen.html/js   # Offscreen Document
│   ├── overlay.css         # 자막 스타일
│   ├── utils/
│   │   ├── platform.js     # 플랫폼 감지
│   │   ├── stt.js         # STT 엔진
│   │   ├── translator.js  # 번역 엔진
│   │   └── cache.js       # 캐싱 시스템
│   └── icons/             # 아이콘
│
├── desktop/                 # Desktop App (선택)
│   ├── main.js             # Electron 메인
│   ├── audio-capture/      # 오디오 캡처
│   ├── stt/               # STT 엔진
│   └── server/            # WebSocket 서버
│
├── docs/                    # 문서
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
│
└── tests/                   # 테스트
    ├── unit/
    └── e2e/
```

### 테스트

```bash
# 단위 테스트
npm test

# 특정 파일 테스트
npm test -- utils/translator.test.js

# E2E 테스트
npm run test:e2e

# 플랫폼별 테스트
npm run test:platform -- --platform=youtube
npm run test:platform -- --platform=twitch

# 커버리지
npm run test:coverage
```

### 수동 테스트 체크리스트

**기본 기능:**
- [ ] Extension 설치 및 활성화
- [ ] 아이콘 클릭 시 캡처 시작
- [ ] 오디오가 정상적으로 들림 (음소거 안 됨)
- [ ] 음성 인식이 정확함
- [ ] 번역이 정확함
- [ ] 자막이 올바른 위치에 표시됨
- [ ] 설정이 저장됨

**플랫폼별:**
- [ ] YouTube Live에서 동작
- [ ] Twitch에서 동작
- [ ] SOOP에서 동작
- [ ] 치지직에서 동작
- [ ] 니코니코에서 동작

**안정성:**
- [ ] 장시간 사용 시 메모리 누수 없음 (1시간+)
- [ ] 네트워크 에러 시 자동 복구
- [ ] API 에러 시 대체 엔진 전환
- [ ] 탭 전환 시 정상 동작
- [ ] 브라우저 재시작 후 설정 유지

**성능:**
- [ ] CPU 사용률 10% 이하
- [ ] 메모리 사용 50MB 이하
- [ ] 지연시간 2초 이내
- [ ] 초기 로딩 1초 이내

### 코딩 스타일

**JavaScript:**
- ES6+ 문법 사용
- async/await 선호 (Promise.then보다)
- const/let 사용 (var 금지)
- 함수명은 동사로 시작 (getUser, createOverlay)
- 클래스명은 PascalCase
- 변수명은 camelCase

**에러 처리:**
- 모든 async 함수는 try-catch
- 사용자에게 의미 있는 에러 메시지
- 콘솔에 상세 에러 로그

**주석:**
- 복잡한 로직에만 주석
- JSDoc 형식 사용
- 한국어 또는 영어 (일관성 유지)

### Pull Request 가이드

**브랜치 전략:**
- `main`: 안정 버전
- `develop`: 개발 중
- `feature/기능명`: 새 기능
- `fix/버그명`: 버그 수정

**커밋 메시지:**
```
[타입] 제목 (50자 이내)

- 상세 설명 (선택)
- 변경 이유
- 관련 이슈: #123

타입: feat, fix, docs, style, refactor, test, chore
```

**예시:**
```
[feat] Twitch 플랫폼 지원 추가

- Twitch 플랫폼 감지 로직 구현
- 이모트 번역 사전 추가
- 저지연 설정 적용

관련 이슈: #45
```

**PR 체크리스트:**
- [ ] 테스트 통과
- [ ] 문서 업데이트
- [ ] CHANGELOG 업데이트
- [ ] 코드 리뷰 요청
- [ ] 스크린샷/영상 첨부 (UI 변경 시)

---

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

```
MIT License

Copyright (c) 2025 Live Stream Translator

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📮 문의 및 지원

### 버그 리포트
- **GitHub Issues**: [링크]
- 재현 단계, 스크린샷, 로그 포함

### 기능 제안
- **GitHub Discussions**: [링크]
- 사용 사례와 예상 효과 설명

### 연락처
- **이메일**: support@livestreamtranslator.app
- **Discord**: [커뮤니티 서버 링크]
- **Twitter**: @LiveStreamTrans

---

## 🎉 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들의 영감을 받았습니다:
- **Chrome Audio Capture** - tabCapture API 사용 방법
- **OpenAI Whisper** - 고품질 STT
- **OBS Studio** - 오디오 캡처 기술

---

## 📝 추가 노트

### 개인정보 보호
- API 키는 사용자 로컬에만 저장
- 번역 내용은 서버에 저장하지 않음
- 사용 통계는 익명으로만 수집 (옵션)

### Chrome Web Store 출시 시 필요사항
- 개인정보 보호정책 작성
- 사용자 데이터 수집 명시
- 스크린샷 5개 (1280x800)
- 프로모션 이미지 (440x280)
- 상세 설명 (영어/한국어)
- 카테고리: Productivity

### 향후 개발 아이디어
- 모바일 앱 (Android/iOS)
- 오프라인 번역 사전
- 음성 합성 (TTS) 추가
- 다중 언어 동시 번역
- AI 요약 기능
- 스트리머 전용 대시보드

---

*이 문서는 AI를 활용한 개발을 위한 종합 가이드입니다. 실제 구현 시 각 플랫폼의 이용약관과 API 정책을 반드시 확인하시기 바랍니다.*

*최종 업데이트: 2025년 10월* 1. Manifest V3 설정
- **필수 권한**: `tabCapture`, `activeTab`, `storage`, `offscreen`
- **host_permissions**: 각 스트리밍 플랫폼 도메인
- **background**: Service Worker로 오디오 캡처 관리
- **content_scripts**: 플랫폼별 자막 오버레이 표시
- **action**: 설정 UI (popup)

#### 2. Background Service Worker
**역할:**
- Extension 아이콘 클릭 감지
- chrome.tabCapture.getMediaStreamId()로 스트림 ID 획득
- Offscreen Document 생성 (Manifest V3 제약 우회)
- Content Script에 스트림 ID 전달
- 캡처 상태 관리 (활성/비활성)
- 탭 닫힘 시 리소스 정리

**중요 사항:**
- Manifest V3에서는 Service Worker가 tabCapture 직접 사용 불가
- Offscreen Document를 통해 우회 필요
- 각 탭별로 캡처 상태 추적 (Map 구조)

#### 3. Content Script (메인 로직)
**핵심 클래스: LiveStreamTranslator**

**주요 메서드:**
- `startCapture()`: 오디오 스트림 시작
- `startSpeechRecognition()`: Web Speech API 초기화
- `translateAndDisplay()`: 번역 및 자막 표시
- `createOverlay()`: 자막 UI 생성
- `stopCapture()`: 캡처 중지 및 정리

**오디오 캡처 핵심:**
- `navigator.mediaDevices.getUserMedia()`로 스트림 획득
- **중요**: AudioContext로 다시 재생해야 음소거 방지
- MediaStream을 Web Speech API에 연결

**음성 인식 (Web Speech API):**
- `continuous: true` - 계속 인식
- `interimResults: true` - 중간 결과도 표시
- 언어별 설정 (en-US, ko-KR, ja-JP 등)
- 인식 중단 시 자동 재시작
- final/interim 결과 구분 처리

**번역 시스템:**
- 다중 엔진 지원 (Papago, DeepL, Google)
- 번역 캐싱으로 중복 API 호출 방지
- API 할당량 추적 및 자동 전환
- 에러 시 fallback 처리

**자막 오버레이:**
- 플랫폼별 위치 자동 조정
- 원문/번역문 동시 표시 옵션
- 반투명 배경 + backdrop-blur
- 최종 자막은 3초 후 페이드아웃
- 모바일/태블릿 반응형 디자인

#### 4. Translation Cache
**구조:**
- 메모리 캐시 (Map): 최근 100개
- IndexedDB: 영구 저장 (선택)
- LRU 정책으로 오래된 항목 제거

**최적화:**
- 동일 문장 재번역 방지
- 배치 번역으로 API 호출 최소화
- 중복 요청 dedupe

#### 5. Popup UI (설정)
**설정 항목:**
- 원본 언어 선택
- 번역 언어 선택
- 번역 엔진 선택 (Papago/DeepL/Google)
- API 키 입력 (각 서비스별)
- 표시 옵션 (원문 표시 여부)
- 플랫폼별 위치 조정

**저장 방식:**
- chrome.storage.sync로 계정 동기화
- 민감 정보(API 키)는 암호화 권장

#### 6. 플랫폼 감지
**감지 방법:**
- URL 패턴 매칭
- DOM 선택자 확인
- 라이브 스트림 여부 확인

**플랫폼별 최적화:**
- YouTube: 자막 위치, 컨트롤바 고려
- Twitch: 채팅창과 겹치지 않게
- SOOP/치지직: 한국어 특화 설정
- 니코니코: 흐르는 코멘트 스타일

---

## 🔧 기술 스택

### Frontend (Chrome Extension)
- **Manifest V3**: 최신 Chrome Extension API
- **Content Script**: 플랫폼별 DOM 조작 및 UI
- **Service Worker**: 백그라운드 작업 관리
- **IndexedDB**: 번역 캐싱

### 오디오 캡처
- **chrome.tabCapture API**: 탭 오디오 스트림
- **Web Audio API**: 오디오 재생 및 처리
- **MediaStream API**: 스트림 관리

### STT (Speech-to-Text) 우선순위

**1순위: YouTube 자막 API (YouTube만)**
- 인식률: 95%+
- 비용: 무료
- 지연: 0.5초
- 제한: YouTube 플랫폼만 사용 가능
- 사용 시점: YouTube에서 자막이 제공되는 경우

**2순위: Web Speech API (기본)**
- 인식률: 80-90%
- 비용: 무료
- 지연: 1-2초
- 제한: Chrome/Edge만, 인터넷 필요
- 장점: 별도 설정 없이 바로 사용
- 단점: 정확도가 다소 낮음

**3순위: Google Cloud STT (고급)**
- 인식률: 85-92%
- 비용: $1.44/시간
- 지연: 0.5-1초
- 장점: 높은 정확도, 실시간 스트리밍
- 사용 시점: 높은 정확도가 필요한 경우

**4순위: OpenAI Whisper (Desktop App 필요)**
- 인식률: 90-95%
- 비용: 무료 (로컬)
- 지연: 1-2초 (GPU 의존)
- 장점: 최고 정확도, 오프라인 작동
- 단점: Desktop App 필수, 리소스 많이 사용

### Translation (TTT)

**Papago (네이버)**
- 한국어 최적화
- 무료: 10,000자/일
- 유료: 별도 문의
- 장점: 한국어↔영어/일본어 최고 품질
- 단점: 일일 할당량 제한

**DeepL**
- 최고 품질 번역
- 무료: 500,000자/월
- 유료: $8.74/월 (Pro)
- 장점: 자연스러운 번역
- 단점: 지원 언어 제한적

**Google Translate**
- 다국어 지원 (100+ 언어)
- 무료: 500,000자/월
- 유료: $20/100만 자
- 장점: 가장 많은 언어 지원
- 단점: 품질이 다소 떨어짐

**ChatGPT API (선택)**
- 문맥 이해 번역
- 비용: $0.002/1K 토큰
- 장점: 자연스러운 번역, 속어 처리
- 단점: 비용, 속도

---

## 📦 모듈 구성

### Chrome Extension 구조
```
extension/
├── manifest.json          (5KB)
├── background.js          (20KB)
├── content.js            (50KB)
├── popup.html/js         (30KB)
├── overlay.css           (10KB)
├── utils/
│   ├── platform.js       (15KB - 플랫폼 감지)
│   ├── stt.js           (25KB - STT 엔진)
│   ├── translator.js    (30KB - 번역 엔진)
│   └── cache.js         (15KB - 캐싱)
└── icons/               (50KB)
─────────────────────────
총 크기: 약 2-3MB
```

### Desktop App 구조 (선택사항)
```
desktop/
├── main.js              (30KB - Electron 메인)
├── audio-capture/       (2MB - OBS Core)
│   ├── windows.js       (WASAPI)
│   ├── mac.js          (Core Audio)
│   └── linux.js        (PulseAudio)
├── stt/                (50-200MB - Whisper 모델)
│   ├── whisper-tiny    (39MB)
│   ├── whisper-base    (74MB)
│   └── whisper-small   (244MB)
└── server/             (20KB - WebSocket)
─────────────────────────
총 크기: 90-250MB (모델 포함)
```

---

## 🎮 플랫폼별 구현 전략

### YouTube / YouTube Live
**특징:**
- 자막 API 우선 사용
- Live 감지: `.ytp-live-badge` 존재 확인
- 자막 위치: 컨트롤바 위 (bottom: 100px)

**최적화:**
- 버퍼 크기: 1024
- 지연시간: 0.5-1초
- STT: YouTube API → Web Speech
- 번역: Papago

### Twitch
**특징:**
- 초저지연 스트리밍
- 채팅창 위치 고려
- 이모트 번역 필요

**최적화:**
- 버퍼 크기: 512 (초저지연)
- 지연시간: 0.5초
- STT: Web Speech (빠름)
- 번역: DeepL (자연스러움)
- 추가: 이모트 사전 (poggers → 대박)

### SOOP (아프리카TV)
**특징:**
- 한국어 스트리밍 중심
- 도네이션 알림 처리
- 한국 인터넷 속어 많음

**최적화:**
- 버퍼 크기: 1024
- STT: CLOVA (네이버) 또는 Web Speech
- 번역: Papago (한국어 최적화)
- 추가: 한국 속어 사전

### 치지직 (Chzzk)
**특징:**
- 네이버 생태계
- 웨일 브라우저 최적화
- SOOP와 유사한 문화

**최적화:**
- SOOP와 동일 설정
- 네이버 API 연동 유리

### 니코니코동화
**특징:**
- 흐르는 코멘트 (弾幕)
- 일본어 특화
- 독특한 속어 문화

**최적화:**
- 버퍼 크기: 2048
- STT: Web Speech (ja-JP)
- 번역: DeepL (일본어 강함)
- 추가: 일본 속어 사전 (www → ㅋㅋㅋ, 草 → ㅋㅋ)

---

## 🚀 개발 로드맵

### Phase 1: Chrome Extension MVP (1주) ⭐ 최우선
**목표: 기본 동작하는 Extension 완성**

**개발 항목:**
- [ ] Manifest V3 기본 구조
- [ ] Background Service Worker (tabCapture 관리)
- [ ] Content Script (오디오 캡처 + STT + 번역)
- [ ] 기본 오버레이 UI
- [ ] Web Speech API 통합
- [ ] Papago API 연동
- [ ] YouTube/Twitch 플랫폼 감지

**테스트:**
- YouTube Live에서 영어→한국어 번역 동작 확인
- 자막 오버레이 위치 확인
- 오디오 음소거 안 되는지 확인

### Phase 2: 번역 & UX 개선 (1주)
**목표: 사용성 향상 및 안정화**

**개발 항목:**
- [ ] 번역 캐싱 시스템 (IndexedDB)
- [ ] Popup 설정 UI
- [ ] API 키 관리 시스템
- [ ] 다중 번역 엔진 (DeepL, Google 추가)
- [ ] 에러 처리 & 자동 복구
- [ ] 로딩 상태 표시
- [ ] 사용 통계 (할당량 추적)

**테스트:**
- 장시간 사용 시 메모리 누수 확인
- API 에러 시 대체 엔진 전환 확인
- 설정 저장/불러오기 동작 확인

### Phase 3: 다중 플랫폼 지원 (1주)
**목표: 모든 주요 플랫폼 지원**

**개발 항목:**
- [ ] SOOP 지원
- [ ] 치지직 지원
- [ ] 니코니코 지원
- [ ] 플랫폼별 UI 최적화
- [ ] 플랫폼별 속어 사전
- [ ] 자동 플랫폼 감지 고도화

**테스트:**
- 각 플랫폼에서 자막 위치 확인
- 플랫폼 전환 시 설정 유지 확인
- 속어 번역 품질 확인

### Phase 4: 고급 기능 & 배포 (1-2주)
**목표: 프로덕션 준비 및 출시**

**개발 항목:**
- [ ] Cloud STT 옵션 (Google STT)
- [ ] 커스텀 용어집 기능
- [ ] 번역 히스토리
- [ ] 피드백 시스템 (👍/👎)
- [ ] 다크 모드
- [ ] 키보드 단축키
- [ ] 성능 최적화
- [ ] Chrome Web Store 제출

**준비 사항:**
- 개인정보 보호정책 작성
- 사용자 가이드 작성
- 스크린샷/비디오 제작
- 버그 리포트 시스템

### Phase 5: Desktop App (선택사항, 3주)
**목표: 고급 사용자를 위한 추가 기능**

**개발 항목:**
- [ ] Electron 앱 개발
- [ ] OBS 오디오 캡처
- [ ] Whisper 통합 (오프라인 STT)
- [ ] WebSocket 서버 (Extension 연동)
- [ ] 시스템 트레이 통합
- [ ] 자동 업데이트

**참고:**
- Desktop App은 Extension 사용자 중 10%만 필요
- Extension이 잘 작동하면 나중에 개발 가능

---

## 🔍 핵심 구현 포인트

### 1. 오디오 음소거 문제 해결
**문제:** tabCapture 사용 시 탭 오디오가 자동 음소거됨

**해결:** AudioContext로 스트림을 destination에 다시 연결
- AudioContext 생성
- createMediaStreamSource()로 소스 생성
- source.connect(context.destination)

### 2. Manifest V3 Service Worker 제약
**문제:** Service Worker에서 tabCapture 직접 사용 불가

**해결 방법 A:** Offscreen Document 사용 (Chrome 116+)
- background에서 offscreen document 생성
- offscreen에서 tabCapture 처리
- 메시지로 결과 전달

**해결 방법 B:** Popup에서 직접 처리
- popup.js에서 tabCapture 호출
- 오디오만 필요한 경우 간단
- 단점: popup 닫히면 중단

### 3. 실시간 음성 인식 안정화
**문제:** Web Speech API가 자주 중단됨

**해결:**
- onend 이벤트에서 자동 재시작
- no-speech 에러는 무시하고 재시작
- 네트워크 에러 시 Cloud STT로 전환
- 타임아웃 설정 (5초 무응답 시 재시작)

### 4. 번역 API 할당량 관리
**전략:**
- 각 서비스 할당량 추적 (localStorage)
- 할당량 초과 시 자동으로 다음 엔진 전환
- 캐싱으로 중복 번역 방지
- 배치 번역으로 API 호출 최소화

**순서:**
1. Papago (일 10,000자)
2. Google (월 500,000자)
3. DeepL (월 500,000자)

### 5. 메모리 관리
**문제:** 장시간 사용 시 메모리 증가

**해결:**
- 캐시 크기 제한 (최대 100개)
- 5분마다 오래된 캐시 정리
- MediaStream 사용 후 반드시 정리
- AudioContext close() 호출
- DOM 요소 제거 시 이벤트 리스너도 제거

### 6. 플랫폼별 UI 위치
**전략:**
- CSS 클래스로 플랫폼 구분 (.platform-youtube)
- 각 플랫폼의 컨트롤바 높이 측정
- z-index 충분히 높게 (999999)
- pointer-events: none으로 클릭 방지

---

## 📊 성능 목표

### Chrome Extension 단독 성능
| 지표 | 목표 | 예상 달성치 | 측정 방법 |
|------|------|------------|----------|
| 초기 로딩 | < 1초 | 0.5초 | chrome.devtools |
| 지연시간 | < 2초 | 0.5-2초 | 음성→자막 표시 |
| 인식률 | > 80% | 80-90% | 테스트 데이터셋 |
| CPU 사용률 | < 10% | 5-10% | Task Manager |
| 메모리 | < 50MB | 30-50MB | chrome.memory |
| 번역 정확도 | > 90% | 90-95% | 수동 평가 |
| 확장 크기 | < 5MB | 2-3MB | 빌드 후 측정 |

### 플랫폼별 성능
| 플랫폼 | 지연 | 인식률 | CPU | 메모리 | 비고 |
|--------|------|--------|-----|--------|------|
| YouTube | 0.5초 | 95% | 5% | 30MB | 자막 API 우선 |
| YouTube Live | 1초 | 85% | 8% | 40MB | tabCapture |
| Twitch | 0.8초 | 85% | 8% | 35MB | 저지연 |
| SOOP | 1초 | 80% | 7% | 35MB | 한국어 |
| 치지직 | 1초 | 80% | 7% | 35MB | 한국어 |
| 니코니코 | 1.5초 | 80% | 10% | 40MB | 일본어 |

### Desktop App 성능 (선택사항)
| 모델 | 인식률 | 처리속도 | CPU | 메모리 | 크기 |
|------|--------|---------|-----|--------|------|
| Whisper Tiny | 85% | 1초 | 20-30% | 200MB | 90MB |
| Whisper Base | 90% | 2초 | 40-60% | 500MB | 200MB |
| Whisper Small | 93% | 4초 | 60-80% | 1GB | 500MB |

---

## 💡 AI 활용 개발 가이드

### Chrome Extension 개발 프롬프트

#### 기본 구조 생성
```
"Manifest V3를 사용하는 Chrome Extension 구조를 만들어줘.
chrome.tabCapture API로 탭의 오디오를 캡처하고,
Web Speech API로 음성을 텍스트로 변환한 다음,
번역된 결과를 오버레이로 표시하는 기능이 필요해.

필요한 파일:
- manifest.json: 권한 및 설정
- background.js: Service Worker (오디오 캡처 관리)
- content.js: 메인 로직 (STT, 번역, UI)
- popup.html/js: 설정 UI
- overlay.css: 자막 스타일

각 파일의 역할과 주요 구현 포인트를 설명해줘."
```

#### tabCapture 구현
```
"chrome.tabCapture API를 사용해서 현재 탭의 오디오를 캡처하는 방법을 설명해줘.
Manifest V3의 Service Worker 제약을 고려해서 Offscreen Document를 활용하고,
캡처된 오디오를 사용자가 계속 들을 수 있도록 AudioContext로 재생하는 방법도 포함해줘.

주의사항:
- Service Worker에서 tabCapture 직접 사용 불가
- 오디오 음소거 문제 해결 필요
- MediaStream 리소스 정리 방법"
```

#### 음성 인식 통합
```
"Web Speech API를 사용해서 실시간으로 음성을 텍스트로 변환하는 방법을 알려줘.
continuous mode로 작동하고, interim results도 표시하며,
인식이 중단되면 자동으로 재시작하는 로직이 필요해.

지원 언어: en-US, ko-KR, ja-JP
처리할 이벤트: onresult, onerror, onend
에러 처리: no-speech, network 등"
```

#### 번역 시스템
```
"Papago, DeepL, Google Translate API를 통합한 번역 시스템 설계를 설명해줘.

요구사항:
- 번역 결과 캐싱 (IndexedDB)
- API 할당량 추적 및 자동 전환
- 중복 요청 방지 (debounce/dedupe)
- 에러 발생 시 fallback
- 각 서비스별 API 호출 방법"
```

#### 배포 및 출시
```
"Chrome Web Store에 Extension을 출시하는 방법을 알려줘.

필요한 준비물:
- 개인정보 보호정책
- 스크린샷 5개
- 프로모션 이미지
- 상세 설명 (다국어)

심사 과정과 주의사항을 설명해줘."
```

#### 성능 모니터링
```
"Chrome Extension의 성능을 모니터링하고 최적화하는 방법을 알려줘.

측정 항목:
- CPU/메모리 사용량
- API 호출 빈도
- 에러 발생률
- 사용자 만족도

도구: chrome.devtools, Sentry 등"
```

#### 사용자 피드백 수집
```
"Extension에 피드백 시스템을 구현하는 방법을 설명해줘.

수집할 정보:
- 번역 품질 평가 (👍/👎)
- 버그 리포트
- 기능 제안
- 사용 통계

프라이버시 고려사항도 포함해줘."
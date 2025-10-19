# 라이브 스트림 통합 번역 시스템 (Live Stream Translator)

## 📋 프로젝트 개요

### 목적
YouTube, Twitch, SOOP, 치지직, 니코니코동화 등 주요 라이브 스트리밍 플랫폼에서 실시간으로 음성을 인식하고 번역하여 자막으로 표시하는 통합 시스템 개발

### 핵심 특징
- 🎯 **다중 플랫폼 지원**: 6개 이상의 주요 스트리밍 플랫폼
- ⚡ **실시간 처리**: 0.5-2초 이내 지연시간
- 🔧 **모듈식 설계**: 필요한 기능만 선택 설치
- 🌐 **오프라인 지원**: 인터넷 없이도 기본 기능 작동
- 💾 **경량화**: 기본 50MB 이하, 최대 150MB

---

## 🏗️ 시스템 아키텍처

### 전체 구조
```
┌──────────────────────────────────────────┐
│          Chrome Extension                 │
├──────────────────────────────────────────┤
│  • Platform Detector                      │
│  • YouTube API Handler                    │
│  • UI Overlay Manager                     │
│  • Translation Cache                      │
└────────────┬─────────────────────────────┘
             │
             ├── YouTube 자막 있음 → YouTube API
             │
             ├── Live/자막 없음 → Desktop App 확인
             │                      ↓
             │                   있음 → Audio Capture
             │                   없음 → Web Speech API
             │
┌────────────┴─────────────────────────────┐
│          Desktop Application              │
├──────────────────────────────────────────┤
│  • OBS Audio Capture Core                 │
│  • STT Engine (Whisper/Google/Web)        │
│  • WebSocket Server (:8777)               │
│  • Process-specific Capture               │
└──────────────────────────────────────────┘
```

### 데이터 플로우
```
[Audio Stream] → [Capture] → [STT] → [Text] → [Translation] → [Display]
                    ↓           ↓        ↓          ↓            ↓
                 OBS/WASAPI  Whisper  Cache    Papago/DeepL   Overlay
```

---

## 🔧 기술 스택

### Frontend (Chrome Extension)
- **Manifest V3**: 최신 Chrome Extension API
- **Content Script**: 플랫폼별 DOM 조작
- **WebSocket Client**: 데스크톱 앱 통신
- **IndexedDB**: 번역 캐싱

### Desktop Application
- **Electron**: 크로스 플랫폼 데스크톱 앱
- **Node.js**: 백엔드 로직
- **OBS Core Library**: 오디오 캡처
- **Native Modules**: OS별 최적화
  - Windows: WASAPI
  - macOS: Core Audio + BlackHole
  - Linux: PulseAudio

### STT (Speech-to-Text)
1. **YouTube 자막 API** (1순위)
   - 인식률: 95%+
   - 비용: 무료
   - 제한: YouTube만

2. **Google Cloud STT** (2순위)
   - 인식률: 85-92%
   - 비용: $1.44/시간
   - 특징: 실시간 스트리밍

3. **OpenAI Whisper** (3순위)
   - 인식률: 80-90%
   - 비용: 무료 (로컬)
   - 특징: 오프라인 작동

4. **Web Speech API** (4순위)
   - 인식률: 70-85%
   - 비용: 무료
   - 제한: Chrome/Edge만

### Translation (TTT)
- **Papago**: 한국어 최적화 (무료 10,000자/일)
- **DeepL**: 최고 품질 (월 $8.74)
- **Google Translate**: 다국어 지원 (무료/유료)
- **ChatGPT API**: 문맥 이해 ($0.002/1K 토큰)

---

## 📦 모듈 구성

### 기본 패키지 (50MB)
```javascript
{
  "core": {
    "extension": "10MB",      // Chrome Extension
    "audioCapture": "15MB",   // OBS Core
    "stt": "5MB",             // Web Speech API
    "translation": "5MB",     // Papago API
    "ui": "5MB",              // Overlay System
    "cache": "10MB"           // 캐싱 시스템
  }
}
```

### 선택 모듈
```javascript
{
  "whisper": {
    "tiny": "39MB",    // 기본 품질
    "base": "74MB",    // 중간 품질
    "small": "244MB"   // 고품질
  },
  "platforms": {
    "twitch": "2MB",   // Twitch 특화
    "soop": "1MB",     // SOOP 특화
    "niconico": "2MB"  // 니코니코 특화
  },
  "features": {
    "chatIntegration": "5MB",
    "vocabulary": "10MB",
    "offlineDict": "20MB"
  }
}
```

---

## 🎮 플랫폼별 구현

### YouTube Live
```javascript
class YouTubeLiveHandler {
  async detect() {
    // 1. 라이브 스트림 감지
    const isLive = !!document.querySelector('.ytp-live-badge');
    
    // 2. 자막 가용성 확인
    const hasSubtitles = !!document.querySelector('.ytp-subtitles-button');
    
    // 3. 최적 방법 선택
    if (hasSubtitles) {
      return 'youtube-api';  // 자막 API 사용
    } else {
      return 'audio-capture'; // 오디오 캡처
    }
  }
  
  config: {
    bufferSize: 1024,
    latency: 'low',
    stt: 'web-speech',
    translation: 'papago'
  }
}
```

### Twitch
```javascript
class TwitchHandler {
  config: {
    bufferSize: 512,         // 초저지연
    latency: 'ultra-low',
    stt: 'whisper-tiny',
    translation: 'deepl',
    features: {
      emoteTranslation: true,  // 이모트 번역
      chatIntegration: true,   // 채팅 연동
      slangDictionary: {       // 속어 사전
        'poggers': '대박',
        'kappa': '(농담)',
        'omegalul': 'ㅋㅋㅋㅋ'
      }
    }
  }
}
```

### SOOP (아프리카TV)
```javascript
class SOOPHandler {
  config: {
    bufferSize: 1024,
    latency: 'low',
    stt: 'clova',           // 네이버 CLOVA
    translation: 'papago',  // 한국어 최적화
    features: {
      koreanSlang: true,    // 한국 인터넷 속어
      donationAlert: true   // 도네이션 번역
    }
  }
}
```

### 치지직 (Naver)
```javascript
class ChzzkHandler {
  config: {
    bufferSize: 1024,
    latency: 'low',
    stt: 'clova',
    translation: 'papago',
    features: {
      naverIntegration: true,  // 네이버 생태계 연동
      whaleOptimized: true     // 웨일 브라우저 최적화
    }
  }
}
```

### 니코니코동화
```javascript
class NiconicoHandler {
  config: {
    bufferSize: 2048,
    latency: 'normal',
    stt: 'google',
    translation: 'deepl',
    features: {
      flowingComments: true,   // 흐르는 코멘트
      弾幕: true,              // 탄막 지원
      japaneseSlang: {         // 일본 속어
        'www': 'ㅋㅋㅋ',
        '草': 'ㅋㅋ',
        '888': '(박수)'
      }
    }
  }
}
```

---

## 💻 구현 가이드

### 1단계: Chrome Extension 개발

#### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Live Stream Translator",
  "version": "1.0.0",
  "permissions": [
    "activeTab",
    "storage",
    "tabCapture"
  ],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://www.twitch.tv/*",
    "https://*.afreecatv.com/*",
    "https://chzzk.naver.com/*",
    "https://live.nicovideo.jp/*"
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["styles.css"]
    }
  ]
}
```

#### content.js 핵심 구조
```javascript
// 1. 플랫폼 감지
const platform = detectPlatform();

// 2. 적절한 핸들러 선택
const handler = getHandlerForPlatform(platform);

// 3. 초기화
await handler.initialize();

// 4. UI 생성
const overlay = new SubtitleOverlay(platform);
overlay.create();

// 5. 번역 시작
handler.on('transcription', async (text) => {
  const translated = await translate(text);
  overlay.update(text, translated);
});
```

### 2단계: Desktop Application 개발

#### 프로젝트 구조
```
desktop-app/
├── main.js              # Electron 메인 프로세스
├── audio-capture/       # 오디오 캡처 모듈
│   ├── windows.js       # WASAPI
│   ├── mac.js          # Core Audio
│   └── linux.js        # PulseAudio
├── stt/                # STT 엔진
│   ├── whisper.js
│   ├── google.js
│   └── web-speech.js
├── server/             # WebSocket 서버
└── native/             # 네이티브 모듈
```

#### 오디오 캡처 구현 (Windows)
```javascript
// Windows WASAPI Loopback
const audioCapture = require('./native/windows-audio');

async function captureSystemAudio() {
  // 시스템 오디오 루프백
  const stream = await audioCapture.createLoopback({
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16
  });
  
  // 특정 프로세스만 캡처 (선택적)
  const chromeAudio = await audioCapture.captureProcess('chrome.exe');
  
  return stream;
}
```

### 3단계: STT 통합

#### 적응형 STT 선택
```javascript
class AdaptiveSTT {
  async selectBestEngine() {
    // 1. YouTube 자막 확인
    if (await this.hasYouTubeSubtitles()) {
      return new YouTubeSTT();
    }
    
    // 2. 데스크톱 앱 확인
    if (await this.isDesktopConnected()) {
      return new WhisperSTT();  // 로컬 Whisper
    }
    
    // 3. 브라우저 API 사용
    return new WebSpeechSTT();
  }
}
```

### 4단계: 번역 최적화

#### 스마트 번역 전략
```javascript
class SmartTranslator {
  constructor() {
    this.engines = {
      papago: new PapagoAPI(),
      deepl: new DeepLAPI(),
      google: new GoogleTranslateAPI()
    };
    
    this.cache = new TranslationCache();
    this.usage = new UsageTracker();
  }
  
  async translate(text, sourceLang, targetLang) {
    // 1. 캐시 확인
    const cached = this.cache.get(text);
    if (cached) return cached;
    
    // 2. 무료 할당량 확인
    const engine = this.selectEngineByQuota();
    
    // 3. 번역 실행
    const result = await engine.translate(text, {
      source: sourceLang,
      target: targetLang
    });
    
    // 4. 캐싱
    this.cache.set(text, result);
    
    return result;
  }
  
  selectEngineByQuota() {
    // Papago: 일 10,000자 무료
    if (this.usage.papago < 10000) return this.engines.papago;
    
    // Google: 월 500,000자 무료
    if (this.usage.google < 16666) return this.engines.google;
    
    // DeepL: 유료 사용
    return this.engines.deepl;
  }
}
```

---

## 🚀 성능 최적화

### 지연시간 최소화
```javascript
const optimizations = {
  // 버퍼 크기 조정
  bufferSize: {
    twitch: 512,      // 0.03초
    youtube: 1024,    // 0.06초
    default: 2048     // 0.12초
  },
  
  // 캐싱 전략
  cache: {
    l1: 'memory',     // 1분
    l2: 'session',    // 30분
    l3: 'indexedDB'   // 영구
  },
  
  // 자주 나오는 문장 사전 로드
  preload: [
    "Thanks for watching",
    "Don't forget to subscribe",
    "Welcome to the stream"
  ]
};
```

### 리소스 관리
```javascript
class ResourceManager {
  monitor() {
    // CPU 사용률 체크
    if (this.cpuUsage > 30) {
      this.downgradeQuality();
    }
    
    // 메모리 사용량 체크
    if (this.memoryUsage > 100) {
      this.clearCache();
    }
    
    // 네트워크 상태 체크
    if (this.networkLatency > 1000) {
      this.switchToOfflineMode();
    }
  }
}
```

---

## 🔧 문제 해결

### 자동 복구 시스템
```javascript
class AutoRecovery {
  async handleError(error) {
    switch(error.type) {
      case 'AUDIO_CAPTURE_FAILED':
        // 오디오 캡처 실패
        await this.restartAudioCapture();
        break;
        
      case 'STT_TIMEOUT':
        // STT 타임아웃
        await this.switchToBackupSTT();
        break;
        
      case 'TRANSLATION_ERROR':
        // 번역 실패
        await this.useAlternativeTranslator();
        break;
        
      case 'DESKTOP_DISCONNECTED':
        // 데스크톱 앱 연결 끊김
        await this.fallbackToBrowserMode();
        break;
    }
  }
}
```

---

## 📊 성능 목표

### 핵심 지표
| 지표 | 목표 | 현재 달성 가능 |
|------|------|--------------|
| 지연시간 | < 2초 | 0.5-2초 |
| 인식률 | > 85% | 85-95% |
| CPU 사용률 | < 15% | 5-15% |
| 메모리 사용 | < 100MB | 50-100MB |
| 번역 정확도 | > 90% | 90-95% |

### 플랫폼별 성능
| 플랫폼 | 지연시간 | 인식률 | CPU |
|--------|---------|--------|-----|
| YouTube | 0.5초 | 95% | 5% |
| Twitch | 0.5초 | 90% | 10% |
| SOOP | 1초 | 85% | 8% |
| 니코니코 | 2초 | 85% | 12% |

---

## 🛠️ 개발 로드맵

### Phase 1: MVP (2주)
- [x] Chrome Extension 기본 구조
- [x] YouTube 자막 API 연동
- [x] 기본 번역 (Papago)
- [x] UI 오버레이

### Phase 2: 데스크톱 앱 (3주)
- [ ] Electron 앱 개발
- [ ] OBS 오디오 캡처
- [ ] WebSocket 서버
- [ ] Whisper 통합

### Phase 3: 다중 플랫폼 (2주)
- [ ] Twitch 지원
- [ ] SOOP 지원
- [ ] 치지직 지원
- [ ] 플랫폼별 최적화

### Phase 4: 고급 기능 (3주)
- [ ] 채팅 연동
- [ ] 커스텀 사전
- [ ] 스트리머별 설정
- [ ] 모바일 앱

### Phase 5: 최적화 (2주)
- [ ] 성능 최적화
- [ ] 자동 복구
- [ ] A/B 테스트
- [ ] 사용자 피드백

---

## 💡 AI 활용 개발 가이드

### 프롬프트 예시

#### 1. 플랫폼 감지 로직
```
"YouTube, Twitch, SOOP 등의 라이브 스트리밍 플랫폼을 자동으로 감지하는 JavaScript 함수를 작성해줘. 
각 플랫폼의 고유한 DOM 선택자와 URL 패턴을 사용하고, 
라이브 스트림 여부도 확인해야 해."
```

#### 2. 오디오 캡처 구현
```
"Electron 앱에서 Windows WASAPI를 사용해 시스템 오디오를 캡처하는 코드를 작성해줘. 
특정 프로세스(chrome.exe)의 오디오만 선택적으로 캡처할 수 있어야 하고, 
16kHz 모노 오디오로 변환해야 해."
```

#### 3. STT 통합
```
"Google Speech-to-Text, OpenAI Whisper, Web Speech API를 
상황에 따라 자동으로 전환하는 적응형 STT 시스템을 구현해줘. 
네트워크 상태와 성능을 모니터링하여 최적의 엔진을 선택해야 해."
```

#### 4. 번역 최적화
```
"Papago, DeepL, Google Translate API를 통합한 번역 시스템을 만들어줘. 
각 서비스의 무료 할당량을 추적하고, 자동으로 전환하며, 
결과를 캐싱하는 기능이 필요해. 플랫폼별 속어 사전도 포함해야 해."
```

### 코드 리뷰 요청
```
"이 라이브 스트림 번역 시스템의 [특정 모듈] 코드를 리뷰해줘. 
성능 최적화, 에러 처리, 코드 구조 개선점을 제안해줘."
```

### 디버깅 도움
```
"[특정 플랫폼]에서 오디오 캡처가 작동하지 않는 문제가 있어. 
[에러 메시지]가 발생하는데, 원인과 해결 방법을 찾아줘."
```

---

## 📚 참고 자료

### API 문서
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [Papago API](https://developers.naver.com/docs/papago/)
- [DeepL API](https://www.deepl.com/docs-api)

### 라이브러리
- [Electron](https://www.electronjs.org/)
- [OBS Studio Source](https://github.com/obsproject/obs-studio)
- [node-record-lpcm16](https://github.com/gillesdemey/node-record-lpcm16)

### 유사 프로젝트
- [Live Caption (Windows 11)](https://support.microsoft.com/en-us/windows/use-live-captions-to-better-understand-audio)
- [OBS Studio](https://obsproject.com/)
- [MORT](https://mort.zz.am/)

---

## 🤝 기여 가이드

### 개발 환경 설정
```bash
# 저장소 클론
git clone https://github.com/yourusername/live-stream-translator.git

# 의존성 설치
cd live-stream-translator
npm install

# Chrome Extension 개발
cd extension
npm run dev

# Desktop App 개발
cd desktop
npm run electron:dev

# 빌드
npm run build
```

### 테스트
```bash
# 단위 테스트
npm test

# E2E 테스트
npm run test:e2e

# 플랫폼별 테스트
npm run test:platform -- --platform=youtube
```

---

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

## 📮 문의 및 지원

- 이슈 트래커: GitHub Issues
- 이메일: support@livestreamtranslator.app
- Discord: [커뮤니티 서버]

---

*이 문서는 AI를 활용한 개발을 위한 가이드입니다. 실제 구현시 각 플랫폼의 이용약관과 API 정책을 확인하시기 바랍니다.*
# Chrome Extension 개발 문서 (Extension)

이 문서는 Live Stream Translator 프로젝트의 **Chrome Extension 개발 전용 기술 문서**입니다.
Manifest V3 기반으로 오디오 캡처 → STT → 번역 → 자막 표시까지의 전체 파이프라인 구현 방법을 포함합니다.

---

# 📌 1. 개요

Chrome Extension은 전체 사용자 중 **90%**가 사용할 핵심 컴포넌트입니다.
시스템 전체 구조 중 다음 기능을 담당합니다:

* 탭 오디오 캡처 (chrome.tabCapture)
* 실시간 STT (Web Speech API 또는 Cloud STT)
* 번역 API 연동 (Papago/DeepL/Google)
* 자막 UI Overlay 표시
* 캐싱 및 설정 관리
* Desktop App과의 선택적 연동

---

# 📁 2. 프로젝트 구조 (Extension)

```
extension/
├── manifest.json
├── background.js (Service Worker)
├── content.js (메인 로직)
├── offscreen.html / offscreen.js
├── popup.html / popup.js (설정 UI)
├── overlay.css
├── utils/
│   ├── platform.js      (플랫폼 감지)
│   ├── stt.js           (STT 엔진)
│   ├── translator.js    (번역 엔진)
│   └── cache.js         (캐시)
└── icons/
```

---

# 🔧 3. Manifest V3 설정

### 반드시 포함해야 할 권한

```json
{
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "offscreen"
  ],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://www.twitch.tv/*",
    "https://chzzk.naver.com/*",
    "https://www.sooplive.co.kr/*",
    "https://www.nicovideo.jp/*"
  ]
}
```

### tabCapture 권한

```json
"permissions": ["tabCapture"]
```

### background 설정

```json
"background": {
  "service_worker": "background.js"
}
```

### content scripts

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "css": ["overlay.css"]
  }
]
```

### offscreen 문서 (필수)

Manifest V3는 오디오 캡처를 직렬로 처리하기 어렵기 때문에 offscreen 문서가 필요함.

```json
"offscreen_documents": [
  {
    "matches": ["*://*/offscreen.html"],
    "js": ["offscreen.js"]
  }
]
```

---

# 🧠 4. 플랫폼 감지 시스템 (platform.js)

플랫폼 감지는 아래 3가지 기준으로 이루어짐:

## 4-1. URL 패턴

```js
if (location.host.includes("youtube.com")) return "youtube";
```

## 4-2. DOM 구조 체크

```js
if (document.querySelector(".ytp-live-badge")) isLive = true;
```

## 4-3. UI 위치/스타일 설정

```js
const PLATFORM_CONFIG = {
  youtube: { bottom: 100 },
  twitch: { bottom: 80 },
  soop: { bottom: 120 }
};
```

---

# 🔊 5. 탭 오디오 캡처 (tabCapture)

### capture 요청 (background.js)

```js
chrome.action.onClicked.addListener(async (tab) => {
  const stream = await chrome.tabCapture.capture({
    audio: true,
    video: false
  });

  chrome.tabs.sendMessage(tab.id, {
    type: "AUDIO_STREAM",
    streamId: stream.id
  });
});
```

### AudioContext로 음소거 방지

```js
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
source.connect(audioContext.destination); // 음소거 방지 핵심
```

---

# 🗣️ 6. 음성 인식 (STT) – Web Speech API

### 기본 설정

```js
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = "ja-JP";
```

### 결과 처리

```js
recognition.onresult = (event) => {
  const result = event.results[event.results.length - 1];
  const text = result[0].transcript;
  const isFinal = result.isFinal;
};
```

### 자동 재시작

```js
recognition.onend = () => {
  setTimeout(() => recognition.start(), 300);
};
```

---

# 🌐 7. 번역 엔진 (translator.js)

### Papago API 호출 예시

```js
async function papagoTranslate(text) {
  const res = await fetch("https://openapi.naver.com/v1/papago/n2mt", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Naver-Client-Id": NAVER_ID,
      "X-Naver-Client-Secret": NAVER_SECRET
    },
    body: `source=ja&target=ko&text=${encodeURIComponent(text)}`
  });
  const data = await res.json();
  return data.message.result.translatedText;
}
```

### 번역 캐싱 (LRU)

```js
const cache = new Map();
function setCache(key, value) {
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}
```

---

# 🖼️ 8. 자막 UI Overlay

### DOM 생성 (content.js)

```js
const overlay = document.createElement("div");
overlay.id = "lst-overlay";
document.body.appendChild(overlay);
```

### CSS (overlay.css)

```css
#lst-overlay {
  position: fixed;
  bottom: 100px;
  width: 100%;
  text-align: center;
  color: white;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(6px);
  font-size: 22px;
  z-index: 999999;
  pointer-events: none;
}
```

---

# ⚠️ 9. 에러 처리 전략

### STT 오류

* network 오류 → 자동 재시작
* no-speech → 무시 후 재시작

### 번역 오류

* Papago 실패 → Google로 fallback
* HTTP 429 → 대기 후 재시작

### 오디오 캡처 오류

* 권한 거부 → 팝업에서 경고 표시

---

# 📦 10. 설정 저장 (chrome.storage)

### 예시

```js
chrome.storage.sync.set({ targetLang: "ko" });
chrome.storage.sync.get(["targetLang"], console.log);
```

---

# 🧪 11. 테스트 가이드

### 기능 테스트

* YouTube Live 테스트 영상
* Twitch 스트리머 테스트 채널

### 성능 테스트

* CPU 사용률 < 10%
* 메모리 < 50MB

### 브라우저 테스트

* Chrome
* Edge
* NAVER Whale

---

# 🧩 12. Chrome Web Store 배포

필수 준비물:

* 개인정보 처리방침
* 스크린샷 5개
* 동영상 데모(선택)
* 카테고리: Productivity

심사 주의사항:

* 과한 권한 요청 금지
* API Key 노출 금지
* 사용자 데이터 수집 금지

---

# 📘 결론

이 문서는 Chrome Extension 개발에 필요한 **기술적 정보만 분리**하여 정리한 문서입니다.
오디오 캡처 → STT → 번역 → UI의 전체 흐름을 Extension 단독으로 구현할 수 있도록 구성되어 있습니다.
# 자막 표시 전략 문서

이 문서는 **실시간 번역 자막**과 **업로드된 자막 파일**을 어떻게 표시할지에 대한 기술적 전략을 정리한 문서입니다.

---

## 📊 1. 자막 표시 방식 분류

### 1-1. 용도별 분류

| 자막 종류 | 특징 | 표시 방식 | 우선순위 |
|----------|------|----------|---------|
| **실시간 번역 자막** | STT → 번역, 0.5~2초 지연 | 커스텀 오버레이 | 최우선 |
| **커뮤니티 자막 (VTT/SRT)** | 사전 제작, 싱크 완벽 | YouTube 네이티브 or 커스텀 | 높음 |
| **디자인 자막 (ASS)** | 스타일/이펙트 포함 | 커스텀 렌더러 필수 | 중간 |
| **YouTube 공식 자막** | 영상에 내장 | YouTube 네이티브 | 기본 |

---

## 🎯 2. 권장 하이브리드 전략

### 2-1. 전체 구조

```
┌─────────────────────────────────┐
│   YouTube Video Player          │
├─────────────────────────────────┤
│                                 │
│  [YouTube 네이티브 자막 영역]      │  ← 커뮤니티 자막 (VTT/SRT)
│                                 │
├─────────────────────────────────┤
│  [커스텀 오버레이 레이어]          │  ← 실시간 번역 자막
│  (높은 z-index)                 │
└─────────────────────────────────┘
```

### 2-2. 동작 원리

**1. 커뮤니티 자막 (사전 제작) → YouTube 네이티브 시스템 활용**
- 장점: 완벽한 싱크, 안정적, 성능 좋음
- 방법: TextTrack API 사용

**2. 실시간 번역 자막 → 커스텀 오버레이**
- 장점: 완전한 제어, 디자인 자유
- 방법: DOM 오버레이 + CSS

**3. 디자인 자막 (ASS) → 커스텀 렌더러**
- 장점: 애니메이션/스타일 표현
- 방법: Canvas 또는 SVG 렌더링

---

## 💻 3. 기술 구현 방법

### 3-1. YouTube 네이티브 자막 시스템 활용 (VTT/SRT)

#### TextTrack API 사용

```javascript
// 1. 비디오 요소 찾기
const video = document.querySelector('video');

// 2. 자막 트랙 추가
const track = video.addTextTrack('subtitles', 'Korean (Community)', 'ko');
track.mode = 'showing'; // 자막 활성화

// 3. VTT 형식으로 큐 추가
track.addCue(new VTTCue(0, 5, '안녕하세요'));
track.addCue(new VTTCue(5, 10, '이것은 커뮤니티 자막입니다'));
```

#### SRT → VTT 변환 후 삽입

```javascript
// SRT 파싱
function parseSRT(srtText) {
  const blocks = srtText.trim().split('\n\n');
  return blocks.map(block => {
    const lines = block.split('\n');
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    const text = lines.slice(2).join('\n');
    
    return {
      start: timeToSeconds(timeMatch[1]),
      end: timeToSeconds(timeMatch[2]),
      text: text
    };
  });
}

// TextTrack에 추가
function loadSRTToYouTube(srtText) {
  const video = document.querySelector('video');
  const track = video.addTextTrack('subtitles', 'Community', 'ko');
  track.mode = 'showing';
  
  const cues = parseSRT(srtText);
  cues.forEach(cue => {
    track.addCue(new VTTCue(cue.start, cue.end, cue.text));
  });
}
```

#### 장점
✅ YouTube UI와 완벽 통합
✅ 자막 설정 (크기, 색상, 배경) 유저가 제어 가능
✅ 성능 최적화 (YouTube 자체 렌더링)
✅ 모바일에서도 안정적

#### 단점
⚠️ 디자인 커스터마이징 제한적
⚠️ 실시간 자막에는 부적합 (지연 발생)

---

### 3-2. 커스텀 오버레이 (실시간 번역)

#### DOM 기반 오버레이

```javascript
// 오버레이 생성
function createSubtitleOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'lst-realtime-overlay';
  overlay.style.cssText = `
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 800px;
    text-align: center;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 22px;
    font-weight: 600;
    z-index: 9999;
    pointer-events: none;
    transition: opacity 0.3s;
  `;
  
  // YouTube 플레이어 컨테이너에 추가
  const playerContainer = document.querySelector('#movie_player');
  playerContainer.appendChild(overlay);
  
  return overlay;
}

// 실시간 업데이트
function updateRealtimeSubtitle(text, isInterim = false) {
  const overlay = document.getElementById('lst-realtime-overlay');
  overlay.textContent = text;
  overlay.style.opacity = isInterim ? '0.6' : '1.0';
}
```

#### 위치 조정 (YouTube 컨트롤 회피)

```javascript
// YouTube 컨트롤 바 높이 감지
function adjustOverlayPosition() {
  const controls = document.querySelector('.ytp-chrome-bottom');
  const controlsHeight = controls ? controls.offsetHeight : 0;
  
  const overlay = document.getElementById('lst-realtime-overlay');
  overlay.style.bottom = `${controlsHeight + 20}px`;
}

// 풀스크린 감지
document.addEventListener('fullscreenchange', adjustOverlayPosition);
```

#### 장점
✅ 완전한 디자인 제어
✅ 실시간 업데이트 최적화
✅ 애니메이션 자유
✅ 듀얼 자막 가능 (원문 + 번역)

#### 단점
⚠️ YouTube UI 변경 시 위치 조정 필요
⚠️ 모바일 대응 복잡

---

### 3-3. ASS 자막 렌더링 (고급 디자인)

#### JavascriptSubtitlesOctopus 라이브러리 활용

```javascript
// ASS 렌더러 초기화
function initASSRenderer() {
  const video = document.querySelector('video');
  
  const renderer = new SubtitlesOctopus({
    video: video,
    subUrl: 'subtitle.ass', // ASS 파일 URL
    fonts: [
      'fonts/Arial.ttf',
      'fonts/NotoSansKR.ttf'
    ],
    workerUrl: 'subtitles-octopus-worker.js',
    legacyWorkerUrl: 'subtitles-octopus-worker-legacy.js'
  });
  
  return renderer;
}
```

#### 장점
✅ 애니메이션/이펙트 완벽 재현
✅ 애니메이션 자막 (karaoke, 위치 이동)
✅ 복잡한 스타일링

#### 단점
⚠️ 라이브러리 용량 큼 (수 MB)
⚠️ 성능 부담
⚠️ 실시간 자막에는 부적합

---

## 🎯 4. 최종 권장 전략

### 4-1. 시나리오별 최적 방식

#### 시나리오 1: 실시간 스트리밍 (Live, Premieres)
**방식:** 커스텀 오버레이 (DOM)
- STT → 번역 → 즉시 표시
- 0.5~2초 지연 최소화
- 임시 텍스트(interim) 표시 가능

#### 시나리오 2: 사전 제작 자막 (커뮤니티 자막)
**방식:** YouTube 네이티브 (TextTrack API)
- VTT/SRT → TextTrack 변환
- YouTube UI 통합
- 유저가 자막 설정 조정 가능

#### 시나리오 3: 듀얼 자막 (원문 + 번역)
**방식:** 하이브리드
- YouTube 네이티브: 원문 (하단)
- 커스텀 오버레이: 번역 (상단)

```
┌─────────────────────────┐
│      Video Area         │
├─────────────────────────┤
│ [커스텀] 번역: 안녕하세요  │  ← 상단
│ [네이티브] Hello everyone │  ← 하단 (YouTube)
└─────────────────────────┘
```

#### 시나리오 4: 디자인 자막 (애니메이션)
**방식:** ASS 렌더러 (선택 사항)
- 애니메이션/karaoke 필요 시만
- 별도 "고급 모드" 제공

---

### 4-2. 사용자 설정 옵션

**자막 표시 모드 선택:**
```
설정 > 자막 표시 방식
  ○ YouTube 네이티브 (권장) ← 기본값
  ○ 커스텀 오버레이 (고급)
  ○ 듀얼 자막 (원문 + 번역)
  ○ ASS 렌더러 (실험적)
```

---

## 💡 5. 구현 우선순위

### Phase 1 (MVP)
- [x] 커스텀 오버레이로 실시간 번역
- [ ] VTT/SRT → TextTrack 변환
- [ ] YouTube 네이티브 자막 활성화

### Phase 2 (개선)
- [ ] 듀얼 자막 모드
- [ ] 자막 위치/스타일 커스터마이징
- [ ] 자동 위치 조정 (컨트롤 바 회피)

### Phase 3 (고급)
- [ ] ASS 자막 지원
- [ ] 애니메이션 효과
- [ ] 자막 프리뷰 기능

---

## 🔧 6. 기술적 고려사항

### 6-1. YouTube API 제한 회피

**문제:**
YouTube는 외부 자막 추가를 공식 지원하지 않음

**해결:**
- TextTrack API는 HTML5 표준이므로 사용 가능
- DOM 조작은 Content Script 권한으로 가능
- YouTube 정책 변경 모니터링 필요

### 6-2. 성능 최적화

**실시간 자막:**
```javascript
// 디바운싱으로 업데이트 최소화
let updateTimer;
function updateSubtitle(text) {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    overlay.textContent = text;
  }, 50); // 50ms 디바운스
}
```

**메모리 관리:**
```javascript
// 오래된 큐 제거 (TextTrack)
function cleanupOldCues(track, currentTime) {
  const cues = Array.from(track.cues);
  cues.forEach(cue => {
    if (cue.endTime < currentTime - 30) { // 30초 이전
      track.removeCue(cue);
    }
  });
}
```

### 6-3. 플랫폼별 대응

**YouTube:**
- `.ytp-chrome-bottom` 높이 감지
- Fullscreen API 대응

**Twitch:**
- `.player-controls-container` 회피
- Theater Mode 대응

**SOOP/치지직:**
- 각 플랫폼별 DOM 구조 분석 필요

---

## 📊 7. 사용자 경험 (UX) 가이드

### 7-1. 자막 모드 자동 선택

**로직:**
```javascript
function selectSubtitleMode(context) {
  if (context.isLive) {
    return 'CUSTOM_OVERLAY'; // 실시간
  } else if (context.hasCommunitySubtitle) {
    return 'YOUTUBE_NATIVE'; // 커뮤니티 자막
  } else if (context.hasOfficialSubtitle) {
    return 'YOUTUBE_NATIVE_WITH_TRANSLATION'; // 공식 자막 + 번역
  } else {
    return 'CUSTOM_OVERLAY'; // 기본
  }
}
```

### 7-2. 자막 충돌 방지

**우선순위:**
1. 사용자가 수동 선택한 자막 (최우선)
2. 커뮤니티 자막 (VTT/SRT)
3. YouTube 공식 자막
4. 실시간 번역 자막 (fallback)

**충돌 처리:**
```javascript
// 커뮤니티 자막이 있으면 실시간 번역 숨김
function handleSubtitleConflict() {
  const hasCommunitySubtitle = checkCommunitySubtitle();
  const realtimeOverlay = document.getElementById('lst-realtime-overlay');
  
  if (hasCommunitySubtitle) {
    realtimeOverlay.style.display = 'none';
    showNotification('커뮤니티 자막이 활성화되었습니다');
  }
}
```

### 7-3. 자막 전환 UI

```
┌─────────────────────────┐
│  자막 설정               │
├─────────────────────────┤
│ ● 커뮤니티 자막 (권장)    │
│ ○ 실시간 번역            │
│ ○ YouTube 공식 자막      │
│ ○ 듀얼 자막 (원문+번역)   │
├─────────────────────────┤
│ [미리보기] [적용]        │
└─────────────────────────┘
```

---

## 🎯 8. 최종 권장사항

### ✅ 기본 전략

**1. 실시간 번역 → 커스텀 오버레이**
- 가장 빠르고 유연
- MVP 단계에서 우선 구현

**2. 커뮤니티 자막 → YouTube 네이티브**
- 안정적이고 성능 좋음
- Phase 2에서 구현

**3. 듀얼 자막 → 하이브리드**
- 언어 학습용
- Phase 3에서 추가

**4. ASS 자막 → 선택 기능**
- 고급 사용자용
- 나중에 고려

### ⚠️ 주의사항

1. **YouTube UI 변경 대응**
   - DOM 구조 모니터링
   - Fallback 로직 필수

2. **성능 최적화**
   - 메모리 누수 방지
   - 디바운싱/쓰로틀링

3. **사용자 선택 존중**
   - 강제 자막 금지
   - 켜기/끄기 쉽게

4. **접근성**
   - 청각장애인 고려
   - 키보드 단축키 제공

---

## 📝 9. 구현 예시 (통합)

### 자막 매니저 클래스

```javascript
class SubtitleManager {
  constructor() {
    this.mode = 'auto'; // auto, native, custom, dual
    this.customOverlay = null;
    this.nativeTrack = null;
  }
  
  // 커뮤니티 자막 로드 (VTT/SRT)
  loadCommunitySubtitle(file) {
    if (this.mode === 'native' || this.mode === 'dual') {
      this.loadToNativeTrack(file);
    } else {
      this.loadToCustomOverlay(file);
    }
  }
  
  // 실시간 자막 업데이트
  updateRealtimeSubtitle(text, isInterim) {
    if (this.mode === 'custom' || this.mode === 'dual') {
      this.customOverlay.update(text, isInterim);
    }
  }
  
  // 모드 전환
  switchMode(newMode) {
    this.mode = newMode;
    this.refresh();
  }
}
```

---

이 문서는 **자막 표시 전략의 모든 측면**을 다룬 종합 가이드입니다.
실제 구현 시 플랫폼별, 시나리오별로 최적 방식을 선택하세요.
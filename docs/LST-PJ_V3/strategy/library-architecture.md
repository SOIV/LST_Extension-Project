# Live Stream Translator – 라이브러리 분리 전략 문서

이 문서는 **프로젝트의 코드 복잡도 관리를 위한 라이브러리 분리 전략**을 정리한 문서입니다.

---

## 📌 1. 왜 라이브러리 분리가 필요한가?

### 1-1. 복잡도 문제

**자막 처리만 해도:**
- 10개+ 포맷 파서 (SRT, VTT, SMI, TTML, DFXP, SBV, ASS 등)
- 인코딩 감지 및 변환 (UTF-8, EUC-KR, CP949 등)
- 타임코드 검증 및 자동 수정
- 포맷 간 변환 (SRT → VTT, SMI → VTT 등)
- TextTrack API 통합
- 오류 처리 및 복구

**예상 코드량:**
```
파서: 1,000줄+
검증: 350줄+
변환: 700줄+
유틸: 250줄+
───────────────
총합: 2,300줄+
테스트: 1,500줄+
문서: 500줄+
───────────────
= 총 4,300줄+
```

**이걸 Extension 코드에 다 넣으면?**
- 코드 구조 복잡
- 유지보수 어려움
- 테스트 복잡
- 재사용 불가능
- 번들 크기 증가

### 1-2. 재사용 필요성

**동일한 자막 처리 로직이 필요한 곳:**
1. Chrome Extension (브라우저)
2. Desktop App (Electron)
3. Web Platform (자막 업로드/편집)
4. CLI 도구 (자막 변환)
5. API 서버 (자막 검증)

**라이브러리 분리 전:**
```
각 프로젝트마다 자막 파서 구현
  → 코드 중복
  → 버그 수정도 중복
  → 일관성 없음
```

**라이브러리 분리 후:**
```
subtitle-parser 라이브러리 하나로:
  → 모든 프로젝트에서 재사용
  → 버그 수정 한 번에 반영
  → 일관된 동작 보장
```

---

## 🏗️ 2. 전체 프로젝트 구조

### 2-1. Monorepo 구조 (권장)

```
livestream-translator/
├── packages/
│   ├── subtitle-parser/          # 핵심 라이브러리 ⭐
│   ├── platform-detector/        # 플랫폼 감지
│   ├── translation-client/       # 번역 API 통합
│   ├── stt-engine/               # STT 엔진 통합
│   └── audio-capture/            # 오디오 캡처 (Desktop용)
│
├── apps/
│   ├── chrome-extension/         # Chrome Extension
│   ├── desktop-app/              # Desktop App (Electron)
│   ├── web-platform/             # 웹 플랫폼
│   └── api-server/               # API 서버
│
├── docs/                         # 통합 문서
├── package.json                  # 루트 package.json
├── pnpm-workspace.yaml           # Workspace 설정
└── README.md
```

### 2-2. 개별 Repository 구조 (대안)

```
GitHub Organization: @livestream-translator

Repositories:
├── subtitle-parser               # npm: @livestream-translator/subtitle-parser
├── platform-detector             # npm: @livestream-translator/platform-detector
├── translation-client            # npm: @livestream-translator/translation-client
├── chrome-extension              # 메인 Extension
├── desktop-app                   # Desktop App
└── web-platform                  # 웹 플랫폼
```

**장점:**
- 각 라이브러리 독립적 개발 가능
- 별도 버전 관리
- 외부 기여 쉬움

**단점:**
- 동시 개발 시 불편
- 버전 sync 관리 필요

---

## 📦 3. 핵심 라이브러리 상세

### 3-1. @livestream-translator/subtitle-parser ⭐

**목적:** 모든 자막 포맷의 파싱, 변환, 검증

#### 디렉토리 구조

```
subtitle-parser/
├── src/
│   ├── parsers/
│   │   ├── srt.ts              # SubRip 파서
│   │   ├── vtt.ts              # WebVTT 파서
│   │   ├── smi.ts              # SAMI 파서
│   │   ├── sbv.ts              # SubViewer 파서
│   │   ├── ttml.ts             # TTML 파서
│   │   ├── dfxp.ts             # DFXP 파서
│   │   ├── ass.ts              # ASS/SSA 파서 (선택)
│   │   ├── base.ts             # 공통 파서 인터페이스
│   │   └── index.ts
│   │
│   ├── validators/
│   │   ├── timecode.ts         # 타임코드 검증
│   │   ├── format.ts           # 포맷 검증
│   │   ├── encoding.ts         # 인코딩 검증
│   │   └── index.ts
│   │
│   ├── converters/
│   │   ├── srt-to-vtt.ts       # SRT → VTT 변환
│   │   ├── smi-to-vtt.ts       # SMI → VTT 변환
│   │   ├── ttml-to-vtt.ts      # TTML → VTT 변환
│   │   ├── to-texttrack.ts     # TextTrack Cue 변환
│   │   ├── encoding.ts         # 인코딩 변환
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── timecode.ts         # 타임코드 계산 유틸
│   │   ├── text.ts             # 텍스트 처리 유틸
│   │   ├── detect.ts           # 포맷 자동 감지
│   │   └── index.ts
│   │
│   ├── types/
│   │   ├── subtitle.ts         # 자막 타입 정의
│   │   ├── cue.ts              # Cue 타입 정의
│   │   └── index.ts
│   │
│   └── index.ts                # 메인 엔트리포인트
│
├── tests/
│   ├── parsers/
│   │   ├── srt.test.ts
│   │   ├── vtt.test.ts
│   │   └── ...
│   ├── validators/
│   ├── converters/
│   └── fixtures/               # 테스트용 자막 파일들
│       ├── sample.srt
│       ├── sample.vtt
│       ├── sample.smi
│       └── ...
│
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE (MIT)
```

#### API 설계

```typescript
// 메인 API
export async function parse(
  content: string,
  options?: ParseOptions
): Promise<ParseResult>;

export function convert(
  cues: Cue[],
  targetFormat: SubtitleFormat
): string;

export function validate(
  content: string,
  format?: SubtitleFormat
): ValidationResult;

export function autoFix(
  content: string,
  format: SubtitleFormat
): FixResult;

// 타입 정의
interface ParseOptions {
  format?: SubtitleFormat;      // 'srt' | 'vtt' | 'smi' | ...
  autoDetect?: boolean;         // 자동 포맷 감지
  encoding?: string;            // 'utf-8' | 'euc-kr' | 'auto'
  strict?: boolean;             // 엄격 모드
}

interface Cue {
  start: number;                // 시작 시간 (초)
  end: number;                  // 종료 시간 (초)
  text: string;                 // 자막 텍스트
  style?: CueStyle;             // 스타일 정보
}

interface ParseResult {
  success: boolean;
  cues: Cue[];
  format: SubtitleFormat;
  encoding: string;
  errors: ParseError[];
  warnings: ParseWarning[];
}
```

#### 사용 예시

```typescript
import { parse, convert, validate } from '@livestream-translator/subtitle-parser';

// 1. 자막 파싱 (자동 감지)
const result = await parse(fileContent, {
  autoDetect: true,
  encoding: 'auto'
});

if (!result.success) {
  console.error('파싱 실패:', result.errors);
  return;
}

// 2. VTT로 변환
const vttContent = convert(result.cues, 'vtt');

// 3. TextTrack Cue로 변환
const textTrackCues = result.cues.map(cue => 
  new VTTCue(cue.start, cue.end, cue.text)
);

// 4. 검증
const validation = validate(fileContent, 'srt');
if (validation.fixable) {
  const fixed = autoFix(fileContent, 'srt');
  console.log('자동 수정됨:', fixed.changes);
}
```

---

### 3-2. @livestream-translator/platform-detector

**목적:** 스트리밍 플랫폼 감지 및 설정 관리

#### 디렉토리 구조

```
platform-detector/
├── src/
│   ├── detectors/
│   │   ├── youtube.ts
│   │   ├── twitch.ts
│   │   ├── soop.ts
│   │   ├── chzzk.ts
│   │   ├── niconico.ts
│   │   └── index.ts
│   │
│   ├── configs/
│   │   ├── youtube.ts          # YouTube DOM 구조, UI 위치
│   │   ├── twitch.ts
│   │   └── ...
│   │
│   ├── types/
│   │   └── platform.ts
│   │
│   └── index.ts
│
├── tests/
├── package.json
└── README.md
```

#### API 설계

```typescript
// 플랫폼 감지
export function detectPlatform(url?: string): Platform | null;

export function getPlatformConfig(platform: Platform): PlatformConfig;

export function isLiveStream(platform: Platform): boolean;

// 타입 정의
type Platform = 
  | 'youtube' 
  | 'twitch' 
  | 'soop' 
  | 'chzzk' 
  | 'niconico';

interface PlatformConfig {
  name: string;
  videoSelector: string;        // video 태그 선택자
  controlsSelector: string;      // 컨트롤 바 선택자
  overlayPosition: {
    bottom: number;
    left: string;
    right: string;
  };
  liveIndicator: string;         // 라이브 감지 선택자
}
```

#### 사용 예시

```typescript
import { detectPlatform, getPlatformConfig } from '@livestream-translator/platform-detector';

// 현재 플랫폼 감지
const platform = detectPlatform();

if (platform === 'youtube') {
  const config = getPlatformConfig(platform);
  
  // 비디오 요소 찾기
  const video = document.querySelector(config.videoSelector);
  
  // 오버레이 위치 설정
  overlay.style.bottom = `${config.overlayPosition.bottom}px`;
}
```

---

### 3-3. @livestream-translator/translation-client

**목적:** 번역 API 통합 및 관리

#### 디렉토리 구조

```
translation-client/
├── src/
│   ├── clients/
│   │   ├── papago.ts           # Naver Papago
│   │   ├── deepl.ts            # DeepL
│   │   ├── google.ts           # Google Translate
│   │   └── index.ts
│   │
│   ├── cache/
│   │   ├── lru.ts              # LRU 캐시
│   │   ├── indexeddb.ts        # IndexedDB 캐시
│   │   └── index.ts
│   │
│   ├── fallback/
│   │   └── strategy.ts         # Fallback 전략
│   │
│   ├── types/
│   │   └── translation.ts
│   │
│   └── index.ts
│
├── tests/
├── package.json
└── README.md
```

#### API 설계

```typescript
// 번역 클라이언트
export class TranslationClient {
  constructor(config: TranslationConfig);
  
  async translate(
    text: string,
    options: TranslationOptions
  ): Promise<TranslationResult>;
  
  async detectLanguage(text: string): Promise<string>;
}

// 설정
interface TranslationConfig {
  engines: TranslationEngine[];  // ['papago', 'deepl', 'google']
  fallback: boolean;             // Fallback 활성화
  cache: {
    enabled: boolean;
    ttl: number;                 // 캐시 유효 시간 (초)
    maxSize: number;             // 최대 캐시 크기
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;         // 최대 요청 수
    perSeconds: number;          // 시간 윈도우
  };
}

interface TranslationOptions {
  source?: string;               // 원본 언어 (auto 가능)
  target: string;                // 대상 언어
  engine?: TranslationEngine;    // 특정 엔진 지정
}
```

#### 사용 예시

```typescript
import { TranslationClient } from '@livestream-translator/translation-client';

const client = new TranslationClient({
  engines: ['papago', 'deepl', 'google'],
  fallback: true,
  cache: {
    enabled: true,
    ttl: 3600,
    maxSize: 1000
  }
});

// 번역
const result = await client.translate('Hello', {
  source: 'en',
  target: 'ko'
});

console.log(result.text);        // "안녕하세요"
console.log(result.engine);      // "papago"
console.log(result.cached);      // false
```

---

### 3-4. @livestream-translator/stt-engine

**목적:** STT 엔진 통합

#### 디렉토리 구조

```
stt-engine/
├── src/
│   ├── engines/
│   │   ├── web-speech.ts       # Web Speech API
│   │   ├── whisper.ts          # Whisper (Desktop용)
│   │   ├── google-cloud.ts     # Google Cloud STT
│   │   └── index.ts
│   │
│   ├── types/
│   │   └── stt.ts
│   │
│   └── index.ts
│
├── tests/
├── package.json
└── README.md
```

#### API 설계

```typescript
export abstract class STTEngine {
  abstract start(options: STTOptions): void;
  abstract stop(): void;
  abstract on(event: STTEvent, callback: Function): void;
}

export class WebSpeechSTT extends STTEngine {
  // Web Speech API 구현
}

export class WhisperSTT extends STTEngine {
  // Whisper 구현 (Desktop용)
}

// 이벤트
type STTEvent = 'interim' | 'final' | 'error' | 'end';

interface STTResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
}
```

#### 사용 예시

```typescript
import { WebSpeechSTT } from '@livestream-translator/stt-engine';

const stt = new WebSpeechSTT({
  lang: 'ja-JP',
  continuous: true,
  interimResults: true
});

stt.on('interim', (result) => {
  console.log('임시:', result.text);
});

stt.on('final', (result) => {
  console.log('확정:', result.text);
  // 번역 시작
});

stt.start();
```

---

### 3-5. @livestream-translator/audio-capture

**목적:** 오디오 캡처 추상화 (Desktop App 전용)

#### 디렉토리 구조

```
audio-capture/
├── src/
│   ├── platforms/
│   │   ├── windows.ts          # WASAPI
│   │   ├── macos.ts            # CoreAudio
│   │   ├── linux.ts            # PulseAudio
│   │   └── index.ts
│   │
│   ├── types/
│   │   └── audio.ts
│   │
│   └── index.ts
│
├── native/                      # Native 모듈
│   ├── windows/
│   ├── macos/
│   └── linux/
│
├── tests/
├── package.json
└── README.md
```

#### API 설계

```typescript
export abstract class AudioCapture {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract getDevices(): Promise<AudioDevice[]>;
  abstract setDevice(deviceId: string): void;
  abstract onData(callback: (data: AudioData) => void): void;
}

export function createAudioCapture(
  platform?: 'windows' | 'macos' | 'linux'
): AudioCapture;

interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output' | 'loopback';
}
```

---

## 🎯 4. 라이브러리 개발 우선순위

### Phase 1: 핵심 (필수)

**1. subtitle-parser** ⭐⭐⭐⭐⭐
- 가장 복잡하고 핵심적
- 모든 앱에서 사용
- 먼저 완성 필요

**예상 기간:** 2~3주

### Phase 2: 통합 (권장)

**2. platform-detector** ⭐⭐⭐⭐
- Extension과 Desktop 공통 사용
- 플랫폼별 대응 필수

**3. translation-client** ⭐⭐⭐⭐
- 번역 로직 재사용
- 캐싱/Fallback 중요

**예상 기간:** 각 1~2주

### Phase 3: 고급 (선택)

**4. stt-engine** ⭐⭐⭐
- STT 로직이 복잡해지면
- 여러 엔진 지원 시

**5. audio-capture** ⭐⭐
- Desktop App 안정화 후
- Native 모듈 필요

**예상 기간:** 각 2~3주

---

## 🛠️ 5. 개발 환경 설정

### 5-1. Monorepo 설정 (pnpm workspace 권장)

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```json
// 루트 package.json
{
  "name": "livestream-translator",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev": "pnpm -r --parallel dev"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "turbo": "^1.10.0"
  }
}
```

### 5-2. TypeScript 설정

```json
// tsconfig.base.json (루트)
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

```json
// packages/subtitle-parser/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 5-3. 빌드 설정 (tsup 권장)

```json
// packages/subtitle-parser/package.json
{
  "name": "@livestream-translator/subtitle-parser",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "test": "vitest"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 📊 6. 테스트 전략

### 6-1. 단위 테스트 (Vitest)

```typescript
// tests/parsers/srt.test.ts
import { describe, test, expect } from 'vitest';
import { parseSRT } from '../src/parsers/srt';

describe('SRT Parser', () => {
  test('기본 SRT 파싱', () => {
    const srt = `
1
00:00:00,000 --> 00:00:05,000
첫 번째 자막

2
00:00:05,000 --> 00:00:10,000
두 번째 자막
    `.trim();
    
    const result = parseSRT(srt);
    
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].text).toBe('첫 번째 자막');
    expect(result.cues[0].start).toBe(0);
    expect(result.cues[0].end).toBe(5);
  });
  
  test('타임코드 오류 처리', () => {
    const invalidSRT = `
1
INVALID --> 00:00:05,000
오류 자막
    `.trim();
    
    const result = parseSRT(invalidSRT);
    
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});
```

### 6-2. 통합 테스트

```typescript
// tests/integration/parse-and-convert.test.ts
import { parse, convert } from '../src';

test('SRT → VTT 변환 플로우', async () => {
  const srtContent = await loadFixture('sample.srt');
  
  // 1. SRT 파싱
  const parsed = await parse(srtContent, { format: 'srt' });
  expect(parsed.success).toBe(true);
  
  // 2. VTT로 변환
  const vttContent = convert(parsed.cues, 'vtt');
  expect(vttContent).toContain('WEBVTT');
  
  // 3. VTT 재파싱 (검증)
  const reparsed = await parse(vttContent, { format: 'vtt' });
  expect(reparsed.cues).toEqual(parsed.cues);
});
```

### 6-3. Fixture 파일 관리

```
tests/fixtures/
├── sample.srt          # 정상 SRT
├── sample.vtt          # 정상 VTT
├── sample.smi          # 정상 SMI
├── invalid.srt         # 오류 포함
├── encoding-euckr.srt  # EUC-KR 인코딩
├── complex-styles.vtt  # 복잡한 스타일
└── ...
```

---

## 📦 7. 배포 전략

### 7-1. npm 배포

```json
// packages/subtitle-parser/package.json
{
  "name": "@livestream-translator/subtitle-parser",
  "version": "0.1.0",
  "description": "Universal subtitle parser and converter",
  "keywords": [
    "subtitle",
    "srt",
    "vtt",
    "smi",
    "parser",
    "converter"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/livestream-translator/subtitle-parser"
  },
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

### 7-2. 버전 관리 (Changesets 권장)

```yaml
# .changeset/config.json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main"
}
```

```bash
# 변경사항 추가
pnpm changeset

# 버전 업데이트
pnpm changeset version

# 배포
pnpm changeset publish
```

### 7-3. CI/CD (GitHub Actions)

```yaml
# .github/workflows/publish.yml
name: Publish Packages

on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          registry-url: 'https://registry.npmjs.org'
      
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build
      
      - name: Publish to npm
        run: pnpm changeset publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 🎯 8. 사용 예시 (실전)

### 8-1. Chrome Extension에서 사용

```typescript
// apps/chrome-extension/src/content.js
import { parse, convert } from '@livestream-translator/subtitle-parser';
import { detectPlatform, getPlatformConfig } from '@livestream-translator/platform-detector';
import { TranslationClient } from '@livestream-translator/translation-client';

// 1. 플랫폼 감지
const platform = detectPlatform();
const config = getPlatformConfig(platform);

// 2. 커뮤니티 자막 로드
async function loadCommunitySubtitle(file) {
  const content = await file.text();
  
  // 3. 자막 파싱
  const result = await parse(content, {
    autoDetect: true,
    encoding: 'auto'
  });
  
  if (!result.success) {
    showError(result.errors);
    return;
  }
  
  // 4. TextTrack에 추가
  const video = document.querySelector(config.videoSelector);
  const track = video.addTextTrack('subtitles', 'Community', 'ko');
  track.mode = 'showing';
  
  result.cues.forEach(cue => {
    track.addCue(new VTTCue(cue.start, cue.end, cue.text));
  });
}

// 5. 실시간 번역
const translator = new TranslationClient({
  engines: ['papago', 'deepl'],
  fallback: true,
  cache: { enabled: true, ttl: 3600, maxSize: 1000 }
});

async function translateAndDisplay(text) {
  const result = await translator.translate(text, {
    source: 'ja',
    target: 'ko'
  });
  
  updateOverlay(result.text);
}
```

### 8-2. Desktop App에서 사용

```typescript
// apps/desktop-app/src/main.ts
import { parse, convert } from '@livestream-translator/subtitle-parser';
import { WhisperSTT } from '@livestream-translator/stt-engine';
import { createAudioCapture } from '@livestream-translator/audio-capture';

// 1. 오디오 캡처
const audioCapture = createAudioCapture();

audioCapture.onData((audioData) => {
  // 2. Whisper STT
  whisperEngine.process(audioData);
});

// 3. STT 결과를 자막으로 저장
const whisperEngine = new WhisperSTT({
  model: 'small',
  language: 'ja'
});

whisperEngine.on('final', async (result) => {
  // 4. 번역
  const translated = await translator.translate(result.text, {
    source: 'ja',
    target: 'ko'
  });
  
  // 5. SRT 파일로 저장
  const cues = [{
    start: result.timestamp,
    end: result.timestamp + result.duration,
    text: translated.text
  }];
  
  const srtContent = convert(cues, 'srt');
  await fs.writeFile('output.srt', srtContent);
});
```

### 8-3. Web Platform에서 사용

```typescript
// apps/web-platform/src/pages/upload.tsx
import { parse, validate, autoFix } from '@livestream-translator/subtitle-parser';

export function SubtitleUpload() {
  const handleUpload = async (file: File) => {
    const content = await file.text();
    
    // 1. 검증
    const validation = validate(content, file.name);
    
    if (!validation.valid) {
      if (validation.fixable) {
        // 2. 자동 수정 제안
        const fixed = autoFix(content, validation.format);
        
        setDiffView({
          original: content,
          fixed: fixed.content,
          changes: fixed.changes
        });
        
        showModal('자동 수정 가능합니다. 적용하시겠습니까?');
      } else {
        showError(validation.errors);
      }
      return;
    }
    
    // 3. 파싱
    const result = await parse(content, {
      format: validation.format,
      encoding: 'auto'
    });
    
    // 4. 데이터베이스 저장
    await uploadSubtitleToServer({
      videoId: currentVideo.id,
      language: 'ko',
      cues: result.cues,
      format: result.format
    });
    
    showSuccess('자막이 업로드되었습니다!');
  };
  
  return (
    <div>
      <FileUploader
        accept=".srt,.vtt,.smi,.sbv,.ttml,.dfxp"
        onUpload={handleUpload}
      />
    </div>
  );
}
```

---

## 💡 9. 추가 장점

### 9-1. 커뮤니티 기여 유도

**독립 라이브러리로 만들면:**
- 별도 GitHub 저장소 → Star 모으기 쉬움
- "subtitle parser library" 검색에 노출
- 다른 개발자들도 사용 가능
- Issue/PR 기여 증가
- 생태계 확장

**예시:**
```
subtitle-parser가 인기를 얻으면:
  → 다른 프로젝트에서도 사용
  → 버그 리포트 증가
  → 커뮤니티 기여 증가
  → 품질 향상
  → 우리 프로젝트도 혜택
```

### 9-2. 포트폴리오 가치

**각 라이브러리가 독립적인 프로젝트:**
- subtitle-parser: 2,000+ 줄의 복잡한 파서
- translation-client: API 통합 및 캐싱
- stt-engine: 멀티 엔진 추상화

**→ 각각이 별도 포트폴리오 항목이 됨**

### 9-3. 유지보수 효율

```
버그 발견:
  subtitle-parser에서 SMI 파싱 오류 발견
    ↓
  subtitle-parser 수정 (1곳)
    ↓
  npm publish
    ↓
  모든 앱에서 업데이트 (pnpm update)
    ↓
  완료!

vs.

각 앱에 코드 중복된 경우:
  Extension 수정
  Desktop App 수정
  Web Platform 수정
  API Server 수정
  → 4번 수정, 테스트도 4번
```

### 9-4. 번들 크기 최적화

**Tree-shaking 가능:**
```typescript
// Extension에서는 ASS 파서 불필요
import { parseSRT, parseVTT } from '@livestream-translator/subtitle-parser';

// ASS 파서는 번들에 포함 안 됨 → 용량 절약
```

**조건부 import:**
```typescript
// Desktop App에서만 Whisper 사용
if (isDesktopApp) {
  const { WhisperSTT } = await import('@livestream-translator/stt-engine');
}
```

---

## 📈 10. 성장 전략

### 10-1. 단계별 오픈소스화

**Phase 1: 내부 사용**
- Monorepo 내부에서만 사용
- 안정화 및 테스트

**Phase 2: 부분 공개**
- subtitle-parser만 먼저 npm 배포
- 피드백 수집

**Phase 3: 전체 공개**
- 모든 라이브러리 오픈소스
- 커뮤니티 구축

### 10-2. 문서화 전략

**각 라이브러리마다:**
- README.md (사용법)
- API.md (API 레퍼런스)
- CONTRIBUTING.md (기여 가이드)
- CHANGELOG.md (변경 이력)
- 예제 코드

**통합 문서 사이트:**
```
docs.livestreamtranslator.com/
├── guide/
│   ├── getting-started
│   ├── subtitle-parser
│   ├── translation-client
│   └── ...
├── api/
└── examples/
```

### 10-3. 마케팅 전략

**npm 패키지 홍보:**
- Reddit r/javascript, r/typescript
- Hacker News
- Dev.to 블로그 포스트
- Twitter/X 공유

**사용 사례 수집:**
- "Powered by subtitle-parser" 뱃지
- 사용 프로젝트 목록 관리
- 케이스 스터디 작성

---

## 🔒 11. 라이선스 전략

### 11-1. 권장 라이선스

**MIT License (권장)** ⭐
- 가장 자유로운 라이선스
- 상업적 사용 가능
- 기여 유도에 유리
- 널리 사용됨

**Apache 2.0 (대안)**
- 특허 보호 포함
- 기업 친화적
- 조금 더 엄격

### 11-2. 라이선스 표시

```
subtitle-parser/
├── LICENSE (MIT)
├── NOTICE (의존성 라이선스 목록)
└── package.json
    "license": "MIT"
```

---

## 📊 12. 성공 지표

### 12-1. 라이브러리별 KPI

**subtitle-parser:**
- npm 다운로드: 월 1,000+
- GitHub Stars: 100+
- 외부 프로젝트 사용: 5+

**platform-detector:**
- npm 다운로드: 월 500+
- GitHub Stars: 50+

**translation-client:**
- npm 다운로드: 월 500+
- GitHub Stars: 50+

### 12-2. 전체 프로젝트 KPI

- 총 npm 다운로드: 월 2,000+
- 총 GitHub Stars: 200+
- 기여자: 10+
- Issue 해결률: 80%+

---

## 🎯 13. 실행 계획

### Week 1-2: subtitle-parser 설계
- [ ] API 설계 확정
- [ ] 타입 정의
- [ ] 프로젝트 구조 생성

### Week 3-4: 기본 파서 구현
- [ ] SRT 파서
- [ ] VTT 파서
- [ ] SBV 파서
- [ ] 단위 테스트

### Week 5-6: 고급 파서 구현
- [ ] SMI 파서
- [ ] TTML 파서
- [ ] DFXP 파서
- [ ] 통합 테스트

### Week 7-8: 변환 및 검증
- [ ] 포맷 변환기
- [ ] 타임코드 검증
- [ ] 자동 수정 기능
- [ ] 인코딩 변환

### Week 9: 문서화 및 배포
- [ ] README 작성
- [ ] API 문서 작성
- [ ] 예제 코드 작성
- [ ] npm 배포

### Week 10+: 추가 라이브러리
- [ ] platform-detector 개발
- [ ] translation-client 개발
- [ ] 통합 테스트

---

## 📝 14. 체크리스트

### 프로젝트 시작 전
- [ ] Monorepo vs 개별 Repo 결정
- [ ] 패키지 매니저 선택 (pnpm 권장)
- [ ] TypeScript 설정
- [ ] 테스트 프레임워크 설정 (Vitest)
- [ ] CI/CD 파이프라인 구축

### subtitle-parser 개발 전
- [ ] API 설계 문서 작성
- [ ] 타입 정의 완료
- [ ] 테스트 케이스 준비
- [ ] Fixture 파일 수집

### 배포 전
- [ ] 모든 테스트 통과
- [ ] 문서 완성
- [ ] 라이선스 명시
- [ ] package.json 검증
- [ ] README 최종 검토

### 배포 후
- [ ] npm 배포 확인
- [ ] GitHub Release 생성
- [ ] 홍보 (Reddit, Twitter)
- [ ] 피드백 모니터링

---

## 🎓 15. 참고 자료

### 유사 라이브러리 연구

**subtitle.js**
- https://github.com/gsantiago/subtitle.js
- SRT/VTT 파서
- 참고할 만한 API 설계

**subsrt**
- Python 자막 변환 라이브러리
- 포맷 감지 로직 참고

**ass-parser**
- https://github.com/weizhenye/ass-parser
- ASS 파싱 참고

### Monorepo 도구

**pnpm workspace**
- https://pnpm.io/workspaces
- 가장 빠른 패키지 매니저

**Turborepo**
- https://turbo.build/repo
- 빌드 캐싱 최적화

**Nx**
- https://nx.dev/
- 엔터프라이즈급 Monorepo

### 배포 도구

**Changesets**
- https://github.com/changesets/changesets
- 버전 관리 및 changelog

**tsup**
- https://tsup.egoist.dev/
- 빠른 TypeScript 번들러

---

## 💡 16. 결론

### 핵심 요약

**✅ 라이브러리 분리는 필수:**
- 코드 복잡도 관리
- 재사용성 극대화
- 유지보수 효율화
- 커뮤니티 확장

**✅ 우선순위:**
1. subtitle-parser (최우선)
2. platform-detector
3. translation-client
4. stt-engine (선택)
5. audio-capture (선택)

**✅ 시작 방법:**
- Monorepo로 시작 (pnpm workspace)
- subtitle-parser부터 개발
- 안정화 후 npm 배포
- 점진적 확장

**✅ 예상 효과:**
- 개발 속도 증가
- 버그 감소
- 커뮤니티 기여 증가
- 프로젝트 가치 상승

### 마지막 조언

**"완벽한 라이브러리를 만들려 하지 말고, 동작하는 라이브러리를 만들어 점진적으로 개선하세요."**

- MVP부터 시작
- 실제 사용하면서 개선
- 커뮤니티 피드백 반영
- 지속적 업데이트

---

이 문서는 **프로젝트의 라이브러리 분리 전략**을 종합적으로 정리한 가이드입니다.
실제 개발 시 단계별로 참고하며 진행하세요.
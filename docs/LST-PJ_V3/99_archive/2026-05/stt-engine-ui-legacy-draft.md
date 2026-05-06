# STT 엔진 설정 UI 설계

## 설정 화면 구조

```
┌─────────────────────────────────────────┐
│   🎙️ 음성 인식 엔진 설정                 │
├─────────────────────────────────────────┤
│                                         │
│ 기본 엔진 선택:                          │
│                                         │
│ ○ Web Speech API (브라우저 내장)         │
│   └─ 무료, 무제한                        │
│   └─ 정확도: ★★★☆☆                  │
│   └─ 지연시간: 낮음                      │
│   └─ 언어: 한국어, 일본어, 영어 등        │
│                                         │
│ ● Whisper API ⭐                        │
│   Provider: [Hugging Face ▼]            │
│                                         │
│   ┌─ OpenAI 공식                        │
│   │  • 정확도: ★★★★★                │
│   │  • 비용: $0.006/분                  │
│   │  • API Key: [**********]            │
│   │  • 상태: ✅ 유효                    │
│   │                                     │
│   ├─ Hugging Face 추론 API              │
│   │  • 정확도: ★★★★☆                │
│   │  • 무료 할당량: 1,000분/월           │
│   │  • Token: [**********]              │
│   │  • 남은 할당량: 847분                │
│   │  • 상태: ✅ 유효                    │
│   │                                     │
│   └─ 커스텀 엔드포인트 (고급)            │
│      • API URL: [https://...]           │
│      • 인증 방식: [Bearer Token ▼]      │
│      • Token/Key: [**********]          │
│      • 테스트: [연결 테스트]             │
│                                         │
│ ○ 기타 STT API (고급 사용자)             │
│   API URL: [https://...]                │
│   인증 방식: [Bearer Token ▼]            │
│   Header Key: [Authorization]           │
│   Header Value: [Bearer **********]     │
│   Request Format: [JSON ▼]              │
│   Response Path: [result.text]          │
│   [연결 테스트] [설정 예시 보기]          │
│                                         │
├─────────────────────────────────────────┤
│ 💡 추천 무료 옵션:                       │
│ • Hugging Face (월 1,000분)             │
│ • Replicate (일 100회)                  │
│ • AssemblyAI (월 5시간)                 │
│                                         │
│ [API 키 받는 방법] [저장]                │
└─────────────────────────────────────────┘
```

---

## Tier별 제공 방식

### Free Tier
```
✅ Web Speech API (무제한)
✅ Whisper API (60분/월, 서버 제공)
✅ 커스텀 엔드포인트 (자신의 API 사용)
```

### Pro Tier
```
✅ Free 모든 기능
✅ Whisper API 무제한 (서버 제공)
✅ 우선 처리 큐
✅ 고급 엔진 (Deepgram, AssemblyAI 등)
```

---

## API 엔드포인트 예시

### 1. Hugging Face 추론 API
```
POST https://api-inference.huggingface.co/models/openai/whisper-large-v3

Headers:
  Authorization: Bearer hf_xxxxxxxxxxxxx

Body:
  { "inputs": "<audio_base64>" }

Response:
  { "text": "인식된 텍스트" }
```

### 2. OpenAI Whisper API
```
POST https://api.openai.com/v1/audio/transcriptions

Headers:
  Authorization: Bearer sk-xxxxxxxxxxxxx

Body (multipart/form-data):
  file: audio.mp3
  model: whisper-1
  language: ja

Response:
  { "text": "인식된 텍스트" }
```

### 3. 커스텀 Whisper (자체 호스팅)
```
POST https://my-server.com/whisper/transcribe

Headers:
  X-API-Key: my_custom_key_123

Body:
  { "audio": "<base64>", "language": "ja" }

Response:
  { "result": { "text": "인식된 텍스트" } }
```

---

## 설정 저장 구조

```javascript
{
  "stt": {
    "engine": "whisper", // "webspeech" | "whisper" | "custom"
    
    "webspeech": {
      "lang": "ja-JP",
      "continuous": true,
      "interimResults": true
    },
    
    "whisper": {
      "provider": "huggingface", // "openai" | "huggingface" | "custom"
      
      "openai": {
        "apiKey": "sk-xxx (encrypted)",
        "model": "whisper-1",
        "endpoint": "https://api.openai.com/v1/audio/transcriptions"
      },
      
      "huggingface": {
        "token": "hf_xxx (encrypted)",
        "model": "openai/whisper-large-v3",
        "endpoint": "https://api-inference.huggingface.co/models/openai/whisper-large-v3"
      },
      
      "custom": {
        "endpoint": "https://my-server.com/whisper/transcribe",
        "authType": "bearer", // "bearer" | "apikey" | "basic" | "none"
        "authKey": "xxx (encrypted)",
        "requestFormat": "json", // "json" | "multipart"
        "responsePath": "result.text" // JSONPath 표현식
      }
    },
    
    "custom": {
      "name": "My Custom STT",
      "endpoint": "https://...",
      "authType": "bearer",
      "authKey": "xxx (encrypted)",
      "requestFormat": "json",
      "responsePath": "text"
    }
  }
}
```

---

## 무료 STT API 옵션 비교

| 서비스 | 무료 할당량 | 정확도 | 지연시간 | 비고 |
|--------|------------|--------|----------|------|
| **Web Speech API** | 무제한 | ★★★☆☆ | 낮음 | 브라우저 내장 |
| **Hugging Face** | 1,000분/월 | ★★★★☆ | 중간 | 가입 필요 |
| **OpenAI (유료)** | $0.006/분 | ★★★★★ | 낮음 | 가장 정확 |
| **Replicate** | 100회/일 | ★★★★☆ | 중간 | API 토큰 |
| **AssemblyAI** | 5시간/월 | ★★★★☆ | 낮음 | 실시간 지원 |

---

## 사용자 가이드 페이지 구조

### 1. Hugging Face 설정 가이드
```
1. https://huggingface.co 가입
2. Settings → Access Tokens
3. "Create new token" 클릭
4. 이름: "LST STT"
5. 권한: Read 체크
6. 토큰 복사 → LST 설정에 붙여넣기

무료 할당량: 월 1,000분
리셋: 매월 1일
```

### 2. OpenAI 설정 가이드
```
1. https://platform.openai.com 가입
2. API Keys → Create new secret key
3. 키 복사 → LST 설정에 붙여넣기

비용: $0.006/분 (1시간 = $0.36)
결제 설정 필요
```

### 3. 커스텀 엔드포인트 설정 예시
```
// 예시 1: 자체 호스팅 Whisper
{
  "endpoint": "https://my-server.com/whisper",
  "authType": "bearer",
  "authKey": "my_secret_key",
  "requestFormat": "json",
  "responsePath": "result.text"
}

// 예시 2: Replicate API
{
  "endpoint": "https://api.replicate.com/v1/predictions",
  "authType": "bearer",
  "authKey": "r8_xxx",
  "requestFormat": "json",
  "responsePath": "output.transcription"
}
```

---

## 고급 기능: API 로드 밸런싱

Pro 사용자 전용 기능으로, 여러 API를 등록하고 자동 전환:

```
API 우선순위:
1. Hugging Face (무료 할당량 남았을 때)
2. OpenAI (할당량 소진 시)
3. 커스텀 엔드포인트 (백업)

자동 전환 조건:
• 429 Too Many Requests
• 할당량 초과
• 5초 이상 응답 없음
• 연속 3회 오류
```

---

## 보안 고려사항

### 1. API 키 저장
```javascript
// 클라이언트 측 암호화
const encryptedKey = await encryptWithAES(apiKey, userSecret);
chrome.storage.local.set({ apiKey: encryptedKey });

// 사용 시 복호화
const apiKey = await decryptWithAES(encryptedKey, userSecret);
```

### 2. 안전한 전송
```javascript
// HTTPS 필수
// 헤더에만 API 키 포함
// 절대 URL에 포함하지 않음
```

### 3. 권한 최소화
```javascript
// 오디오 데이터만 전송
// 개인정보 제거
// 익명화된 요청
```

---

## UI/UX 개선 아이디어

### 1. 원클릭 설정
```
[🚀 빠른 시작]
→ Hugging Face 계정 연결 (OAuth)
→ 자동으로 토큰 생성
→ 바로 사용 가능
```

### 2. 실시간 사용량 표시
```
┌──────────────────────┐
│ 📊 이번 달 사용량     │
├──────────────────────┤
│ Hugging Face:        │
│ ▓▓▓▓▓▓▓░░░ 153 / 1000│
│                      │
│ OpenAI: $2.34        │
│ ▓░░░░░░░░░ 390 / ?   │
└──────────────────────┘
```

### 3. 비용 계산기
```
예상 사용량:
• 하루 2시간 시청
• 월 60시간

예상 비용:
• Hugging Face: 무료 (할당량 내)
• OpenAI: $21.60/월
• 추천: Hugging Face + OpenAI 조합
```

---

## 결론

이 시스템의 장점:

✅ **유연성**: 어떤 STT API도 연결 가능
✅ **비용 효율**: 무료 옵션 최대 활용
✅ **확장성**: 새 API 추가 용이
✅ **사용자 선택**: 품질 vs 비용 선택 가능
✅ **투명성**: 사용량 실시간 확인

Free 사용자도 자신의 API 키만 있으면 무제한 사용 가능!

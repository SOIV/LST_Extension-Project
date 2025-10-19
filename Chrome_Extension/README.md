# Live Stream Translator - Chrome Extension

실시간 스트리밍 플랫폼 통합 번역 시스템

## 🎯 기능

- **다중 플랫폼 지원**: YouTube, Twitch, SOOP, 치지직, 니코니코동화
- **실시간 음성 인식**: Web Speech API 기반
- **다중 번역 엔진**: Google Translate, Papago, DeepL
- **자막 오버레이**: 비디오 위에 실시간 번역 자막 표시
- **유연한 UI 커스터마이징**:
  - 자막 크기 7단계 조절 (50% ~ 300%)
  - 그라디언트 슬라이더 인터페이스
  - 자막 위치 선택 (상단/중앙/하단)
- **번역 캐싱**: API 사용량 절감
- **플랫폼별 최적화**: 각 플랫폼의 UI와 언어에 맞춤 설정
- **설정 관리**: 캐시 삭제 및 설정 초기화 기능

## 📋 지원 플랫폼

| 플랫폼 | URL 패턴 | 기본 언어 | 특수 기능 |
|--------|----------|-----------|-----------|
| YouTube | youtube.com/watch | auto | YouTube API 자막 우선 |
| Twitch | twitch.tv/* | en | 이모트 번역 |
| SOOP | play.sooplive.co.kr | ko | 한국어 속어 사전 |
| 치지직 | chzzk.naver.com/live | ko | 네이버 통합 |
| 니코니코 | nicovideo.jp | ja | 일본어 속어 사전 |

## 🚀 설치 방법

### Chrome Web Store (권장)
1. [Chrome Web Store 링크] 방문
2. "Chrome에 추가" 클릭
3. 권한 확인 후 설치

### 개발자 모드로 설치
1. 이 저장소를 클론하거나 다운로드
   ```bash
   git clone https://github.com/SOIV/LST_Extension-Project.git
   cd LST_Extension-Project/Chrome_Extension
   ```

2. Chrome 브라우저에서 `chrome://extensions/` 접속

3. 우측 상단의 "개발자 모드" 활성화

4. "압축해제된 확장 프로그램을 로드합니다" 클릭

5. `Chrome_Extension` 폴더 선택

## 📖 사용 방법

### 기본 사용

1. 지원하는 스트리밍 플랫폼의 라이브 방송 페이지로 이동
2. Extension 아이콘 클릭 (자동으로 캡처 시작)
3. 실시간 번역 자막이 비디오 위에 표시됨
4. 중지하려면 Extension 아이콘을 다시 클릭

### 설정

Extension 아이콘을 클릭하면 설정 팝업이 열립니다:

#### 언어 설정
- **원본 언어**: 자동 감지 또는 특정 언어 선택
- **번역 언어**: 원하는 번역 언어 선택

#### 번역 엔진
- **Google Translate**: 무료, API 키 불필요 (기본)
- **Papago**: 한국어 최적화, API 키 필요
- **DeepL**: 최고 품질, API 키 필요

#### 표시 옵션
- **원문 표시**: 원문과 번역문을 함께 표시
- **자막 위치**: 상단/중앙/하단 선택
- **자막 크기**: 50% ~ 300% (슬라이더로 조절)
- **번역 캐싱**: API 사용량 절감을 위한 캐싱

#### 상태 및 관리
- **Web Speech API 상태**: 음성 인식 지원 여부 확인
- **번역 캐시**: 캐시된 번역 항목 수 확인 및 삭제
- **설정 초기화**: 모든 설정을 기본값으로 되돌리기

## 🔑 API 키 발급

### Google Translate
- 기본 Public API는 무료로 사용 가능
- Apps Script API를 사용하려면 [Google Apps Script](https://script.google.com/)에서 배포

### Papago
1. [네이버 클라우드 플랫폼](https://www.ncloud.com/) 가입
2. "AI·NAVER API" → "Papago Translation" 선택
3. API 키와 Secret 발급
4. Extension 설정에서 입력

### DeepL
1. [DeepL API](https://www.deepl.com/pro-api) 가입
2. Free 또는 Pro 요금제 선택
3. API 키 발급
4. Extension 설정에서 입력

## 🛠️ 개발

### 프로젝트 구조

```
Chrome_Extension/
├── manifest.json          # Extension 설정
├── popup.html            # 설정 UI
├── icons/                # 아이콘 파일
├── locales/              # 다국어 지원
│   └── ko/
│       └── messages.json
├── scripts/
│   ├── background.js     # Service Worker
│   ├── content.js        # 메인 로직
│   ├── popup.js         # 설정 UI 로직
│   └── utils/
│       ├── platform.js   # 플랫폼 감지
│       ├── stt.js       # 음성 인식
│       └── translator.js # 번역 엔진
└── styles/
    ├── overlay.css      # 자막 스타일
    └── popup.css        # 설정 UI 스타일
```

### 기술 스택

- **Manifest V3**: 최신 Chrome Extension API
- **Web Speech API**: 실시간 음성 인식
- **chrome.tabCapture**: 탭 오디오 캡처
- **Web Audio API**: 오디오 처리
- **Chrome Storage API**: 설정 및 번역 캐싱
- **CSS3**: 그라디언트 슬라이더 및 반응형 디자인
- **다크모드 지원**: `prefers-color-scheme` 미디어 쿼리

### 개발 모드 실행

1. 코드 수정
2. Chrome Extensions 페이지에서 새로고침 버튼 클릭
3. 스트리밍 페이지 새로고침
4. 테스트

### 디버깅

1. Extension 아이콘 우클릭 → "Inspect popup" (Popup 디버깅)
2. F12 개발자 도구 → Console 탭 (Content Script 로그)
3. `chrome://extensions/` → "Service Worker" 클릭 (Background 로그)

## 🐛 문제 해결

### 음성 인식이 안 됨
- 페이지를 새로고침하세요
- Web Speech API가 지원되는 브라우저인지 확인하세요 (Chrome, Edge)
- 인터넷 연결을 확인하세요

### 번역이 안 됨
- API 키가 올바른지 확인하세요
- API 할당량을 확인하세요
- 번역 엔진을 Google Translate로 변경해보세요

### 자막이 보이지 않음
- 자막 위치를 다른 곳으로 변경해보세요
- 브라우저 확대/축소 비율을 확인하세요
- F12 개발자 도구에서 에러 로그를 확인하세요

### 오디오가 들리지 않음
- 이는 정상입니다. Extension이 오디오를 캡처하지만 원본 오디오는 계속 재생됩니다
- 만약 오디오가 음소거되었다면, 페이지를 새로고침하세요

## 📝 권한 설명

Extension이 요청하는 권한:

- **tabCapture**: 탭의 오디오를 캡처하여 음성 인식에 사용
- **activeTab**: 현재 활성 탭 정보 확인
- **storage**: 사용자 설정 저장
- **offscreen**: Manifest V3 제약 우회를 위한 Offscreen Document
- **host_permissions**: 지원하는 스트리밍 플랫폼에서만 작동

## 🤝 기여

버그 리포트, 기능 제안, Pull Request를 환영합니다!

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

GPL-3.0 License - 이 프로젝트는 GNU General Public License v3.0 하에 배포됩니다.

주요 내용:
- 소스 코드를 자유롭게 사용, 수정, 배포 가능
- 수정된 버전을 배포할 때는 동일한 GPL-3.0 라이선스 적용 필수
- 소스 코드 공개 의무
- 상업적 사용 가능

자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.

## 📮 문의

- GitHub Issues: [issues](https://github.com/SOIV/LST_Extension-Project/issues)
- Email: biz@soiv-studio.xyz

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들의 영감을 받았습니다:
- Chrome Audio Capture Extension
- [Speech Translator Chrome Extension](https://chromewebstore.google.com/detail/jodfjmaiakpnmeddgpeflpafebmlhppn?utm_source=item-share-cb)
- Web Speech API Examples
- OBS Studio
# Live Stream Translator (LST) Extension Project

실시간 스트리밍 플랫폼을 위한 통합 번역 시스템

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)

## 📖 프로젝트 개요

Live Stream Translator는 YouTube, Twitch, SOOP, 치지직, 니코니코동화 등의 스트리밍 플랫폼에서 실시간으로 음성을 인식하고 번역하여 자막으로 표시해주는 Chrome 확장 프로그램입니다.

## ✨ 주요 기능

### 🌍 다중 플랫폼 지원
- YouTube / YouTube Live
- Twitch
- SOOP (구 아프리카TV)
- 치지직 (Chzzk)
- 니코니코동화

### 🎙️ 실시간 음성 인식 및 번역
- Web Speech API 기반 실시간 음성 인식
- Google Translate, Papago, DeepL 번역 엔진 지원
- 원문과 번역문 동시 표시

### 🎨 커스터마이징 가능한 UI
- **자막 크기**: 7단계 조절 (50%, 75%, 100%, 150%, 200%, 250%, 300%)
- **자막 위치**: 상단, 중앙, 하단 선택
- **그라디언트 슬라이더**: 직관적인 크기 조절 인터페이스
- **다크모드 지원**: 시스템 테마 자동 감지

### ⚙️ 고급 기능
- **번역 캐싱**: 동일 문장 재번역 방지로 API 사용량 절감
- **플랫폼별 속어 사전**: 각 플랫폼의 특수 용어 및 이모트 지원
- **설정 초기화**: 원클릭으로 모든 설정 기본값 복원
- **실시간 상태 모니터링**: Web Speech API 지원 여부 및 캐시 상태 확인

## 🚀 빠른 시작

### 설치 방법

### 🏪 Chrome 웹 스토어 (예정)

> 📅 **Chrome 웹 스토어 업로드 예정**: 더 편리한 설치와 업데이트를 위해 Chrome 웹 스토어 등록을 준비 중입니다.

### 📦 릴리즈에서 다운로드 (권장)

1. [Releases 페이지](https://github.com/SOIV/LST_Extension-Project/releases)에서 최신 버전 다운로드
2. 다운로드한 ZIP 파일을 원하는 폴더에 압축 해제
3. Chrome 브라우저에서 `chrome://extensions/` 접속
4. 우측 상단의 "개발자 모드" 토글 활성화
5. "압축해제된 확장 프로그램을 로드합니다." 클릭
6. 압축 해제한 폴더 선택
7. 확장 프로그램이 설치되고 YouTube에서 사용 가능

### 사용 방법
1. 지원하는 스트리밍 사이트 방문
2. 라이브 방송 시청
3. 확장 프로그램 아이콘 클릭
4. 실시간 번역 자막 표시

## 📂 프로젝트 구조

```
LST_Extension-Project/
├── Chrome_Extension/         # Chrome 확장 프로그램
│   ├── manifest.json        # Extension 설정
│   ├── popup.html          # 설정 UI (사이드바 네비게이션)
│   ├── icons/              # 확장 프로그램 아이콘
│   ├── _locales/           # 다국어 지원 (한국어)
│   ├── scripts/
│   │   ├── background.js   # Service Worker
│   │   ├── content.js      # 메인 로직 (STT, 번역, 오버레이)
│   │   ├── popup.js        # 설정 UI 로직
│   │   └── utils/
│   │       ├── platform.js # 플랫폼 감지 및 최적화
│   │       ├── stt.js      # 음성 인식 엔진
│   │       └── translator.js # 번역 엔진 (Google/Papago/DeepL)
│   └── styles/
│       ├── overlay.css     # 자막 오버레이 스타일
│       └── popup.css       # 설정 UI 스타일 (그라디언트 슬라이더)
└── README.md               # 이 파일
```

## 🛠️ 기술 스택

- **Manifest V3**: 최신 Chrome Extension API
- **Web Speech API**: 실시간 음성 인식
- **chrome.tabCapture**: 탭 오디오 캡처
- **Web Audio API**: AudioContext 기반 오디오 처리
- **Chrome Storage API**: 동기/비동기 설정 저장
- **CSS3**:
  - Flexbox/Grid 레이아웃
  - CSS Variables
  - Gradient 슬라이더
  - 다크모드 (`prefers-color-scheme`)

## 🎨 UI/UX 특징

### 설정 인터페이스
- **사이드바 네비게이션**: 5개 탭 (언어, 번역, 표시, 상태, 정보)
- **그라디언트 디자인**: 보라색 계열 통일감 있는 디자인
- **반응형 레이아웃**: 750px × 520px 팝업
- **애니메이션**: 부드러운 페이드인/슬라이드 전환

### 자막 크기 조절 슬라이더
- **7단계 눈금**: 각 퍼센트 위치마다 원형 마커
- **그라디언트 트랙**: #667eea → #764ba2
- **그라디언트 눈금**: 각 마커가 트랙 색상에 맞춰 변화
- **실시간 피드백**: 슬라이더 조작 시 즉시 퍼센트 표시 업데이트

## 🔑 번역 엔진 설정

### Google Translate (기본)
- API 키 불필요
- 무료 사용 가능
- 100개 이상 언어 지원

### Papago
1. [네이버 클라우드 플랫폼](https://www.ncloud.com/) 가입
2. Papago Translation API 생성
3. Client ID와 Client Secret 발급
4. 확장 프로그램 설정에 입력

### DeepL
1. [DeepL API](https://www.deepl.com/pro-api) 가입
2. API 키 발급
3. 확장 프로그램 설정에 입력

## 🐛 문제 해결

### 음성 인식 안 됨
- 페이지 새로고침
- Chrome/Edge 브라우저 사용 확인
- 인터넷 연결 확인

### 자막이 안 보임
- 자막 위치 변경 (상단 ↔ 하단)
- 자막 크기 조절
- F12 개발자 도구에서 에러 로그 확인

### 설정이 저장 안 됨
- 상태 탭에서 "설정 초기화" 후 재설정
- chrome://extensions/ 에서 확장 프로그램 재시작

## 📜 라이선스

GPL-3.0 License - 이 프로젝트는 GNU General Public License v3.0 하에 배포됩니다.<br>
자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🤝 기여

버그 리포트, 기능 제안, Pull Request 환영합니다!

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📮 문의

- GitHub Issues: [issues](https://github.com/SOIV/LST_Extension-Project/issues)
- Email: biz@soiv-studio.xyz

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들의 영감을 받았습니다:
- [Speech Translator Chrome Extension](https://chromewebstore.google.com/detail/jodfjmaiakpnmeddgpeflpafebmlhppn?utm_source=item-share-cb)
- Chrome Audio Capture Extension
- Web Speech API Examples
- OBS Studio

이 프로젝트는 전 세계 스트리밍 커뮤니티의 언어 장벽을 허무는 데 기여하고자 만들어졌습니다.
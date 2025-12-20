# Live Stream Translator(LST) Extension Project

실시간 스트리밍 플랫폼을 위한 통합 번역 시스템

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)

## 📖 프로젝트 개요

프로젝트 계획 및 설계는 [LST-PJ_V3](docs/LST-PJ_V3)에서 확인바랍니다.<br>
기존에 잠시 제작했던 확장 프로그램 코드는 초기화 후 재작성 될 예정입니다.

Live Stream Translator는 YouTube, Twitch, SOOP, 치지직, 니코니코동화 등의 스트리밍 플랫폼에서 실시간으로 음성을 인식하고 번역하여 자막으로 표시해주는 Chrome 확장 프로그램입니다.

## ✨ 주요 기능

### 🌍 다중 플랫폼 지원
- YouTube / YouTube Live
- Twitch
- SOOP (구 아프리카TV)
- 치지직 (Chzzk)
- 니코니코동화

## 🚀 빠른 시작

### 설치 방법

### 🏪 Chrome 웹 스토어 (예정)

> 📅 **Chrome 웹 스토어 업로드 예정**: 더 편리한 설치와 업데이트를 위해 Chrome 웹 스토어 등록을 준비 중입니다.

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
│   ├── _locales/           # 다국어 지원
│   ├── scripts/
│   │   └── utils/
│   └── styles/
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

### 프로젝트 초기화 예정

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
- Discord Community and Support: https://discord.gg/tVnhbaB9yY
- Email: biz@soiv-studio.xyz

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들의 영감을 받았습니다:
- [Speech Translator Chrome Extension](https://chromewebstore.google.com/detail/jodfjmaiakpnmeddgpeflpafebmlhppn?utm_source=item-share-cb)
- Chrome Audio Capture Extension
- Web Speech API Examples

이 프로젝트는 전 세계 스트리밍 커뮤니티의 언어 장벽을 허무는 데 기여하고자 만들어졌습니다.
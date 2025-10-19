# Live Stream Translator - 설치 및 테스트 가이드

## 📦 설치 전 준비사항

### 1. 아이콘 파일 생성

현재 아이콘 파일이 없으므로, 다음 중 하나를 선택하세요:

#### 옵션 A: 임시 아이콘 생성 (빠른 테스트용)

온라인 도구를 사용하여 간단한 아이콘 생성:
1. https://www.favicon-generator.org/ 접속
2. 텍스트 또는 이미지로 아이콘 생성
3. 다운로드 후 `icons/` 폴더에 저장
4. 파일명을 다음과 같이 변경:
   - `icon16.png` (16x16px)
   - `icon32.png` (32x32px)
   - `icon48.png` (48x48px)
   - `icon128.png` (128x128px)

#### 옵션 B: ImageMagick으로 자동 생성

```bash
cd Chrome_Extension/icons

# 기본 아이콘 (보라색)
convert -size 16x16 xc:#667eea icon16.png
convert -size 32x32 xc:#667eea icon32.png
convert -size 48x48 xc:#667eea icon48.png
convert -size 128x128 xc:#667eea icon128.png

# 활성 아이콘 (녹색)
convert -size 16x16 xc:#4caf50 icon16-active.png
convert -size 32x32 xc:#4caf50 icon32-active.png
convert -size 48x48 xc:#4caf50 icon48-active.png
convert -size 128x128 xc:#4caf50 icon128-active.png
```

#### 옵션 C: 디자인 직접 제작

Figma, Photoshop, GIMP 등을 사용하여 직접 제작

---

## 🚀 Chrome Extension 설치

### 1. Chrome 브라우저 열기

Chrome 또는 Edge 브라우저를 사용하세요.

### 2. Extensions 페이지 접속

다음 중 하나의 방법:
- 주소창에 `chrome://extensions/` 입력
- 메뉴 → 도구 더보기 → 확장 프로그램
- 단축키: `Ctrl+Shift+E` (Windows) / `Cmd+Shift+E` (Mac)

### 3. 개발자 모드 활성화

우측 상단의 "개발자 모드" 토글 스위치를 켜세요.

### 4. Extension 로드

1. "압축해제된 확장 프로그램을 로드합니다" 버튼 클릭
2. `Chrome_Extension` 폴더 선택
3. "폴더 선택" 클릭

### 5. 설치 확인

- Extension 목록에 "Live Stream Translator" 표시 확인
- 에러가 있다면 빨간색으로 표시됨 (에러 해결 섹션 참고)

---

## 🧪 테스트 방법

### 1. 기본 테스트

#### YouTube Live 테스트
1. https://www.youtube.com/results?search_query=live 접속
2. 영어 또는 일본어 라이브 방송 선택
3. Extension 아이콘 클릭
4. 자막이 비디오 위에 표시되는지 확인

#### Twitch 테스트
1. https://www.twitch.tv/ 접속
2. 인기 스트리머 방송 선택
3. Extension 아이콘 클릭
4. 실시간 번역 확인

### 2. 설정 테스트

1. Extension 아이콘 클릭하여 Popup 열기
2. 다양한 설정 변경:
   - 원본 언어: `자동 감지`
   - 번역 언어: `한국어`
   - 번역 엔진: `Google Translate`
   - 자막 위치: `하단`
   - 자막 크기: `보통`
3. "설정 저장" 클릭
4. 페이지 새로고침 후 다시 테스트

### 3. 기능별 테스트

#### ✅ 음성 인식 테스트
- 음성이 정확히 인식되는가?
- Interim 결과가 표시되는가?
- Final 결과로 업데이트되는가?

#### ✅ 번역 테스트
- 번역이 정확한가?
- 번역 속도는 적절한가?
- 캐시가 작동하는가? (같은 문장 반복 시)

#### ✅ UI 테스트
- 자막이 비디오 위에 표시되는가?
- 자막 위치가 적절한가?
- 플랫폼별로 위치가 다른가?
- 페이드아웃이 작동하는가?

#### ✅ 성능 테스트
- 메모리 사용량 확인 (Chrome Task Manager)
- CPU 사용률 확인
- 장시간 사용 시 안정성 확인 (30분+)

---

## 🐛 에러 해결

### 에러: "Manifest file is missing or unreadable"

**원인**: manifest.json 파일을 찾을 수 없음

**해결**:
1. 폴더 선택이 올바른지 확인 (`Chrome_Extension` 폴더 선택)
2. manifest.json 파일이 존재하는지 확인

### 에러: "Could not load icon 'icons/icon16.png'"

**원인**: 아이콘 파일이 없음

**해결**:
1. "설치 전 준비사항" 섹션의 아이콘 생성 방법 참고
2. `icons/` 폴더에 필요한 아이콘 파일 생성

### 에러: "Uncaught SyntaxError: Cannot use import statement outside a module"

**원인**: ES6 모듈 사용 시 type="module" 누락

**해결**:
1. manifest.json에서 background.service_worker의 `"type": "module"` 확인
2. content_scripts는 ES6 모듈 미지원 - 번들링 필요 (현재는 일반 스크립트로 수정 필요)

### Content Script에서 모듈 사용 불가

**문제**: Content Script는 ES6 모듈을 직접 지원하지 않음

**해결 방법**:

#### 옵션 1: 번들러 사용 (권장)
```bash
npm install -g esbuild

# content.js 번들링
esbuild scripts/content.js --bundle --outfile=scripts/content.bundle.js
```

그리고 manifest.json 수정:
```json
"content_scripts": [
  {
    "js": ["scripts/content.bundle.js"],
    ...
  }
]
```

#### 옵션 2: import 제거하고 모든 코드를 하나의 파일로 통합

현재 구조에서는 **옵션 2**가 더 간단합니다.

---

## 📝 코드 수정 필요 사항

### Content Script 모듈 문제 해결

`scripts/content.js`의 상단 import 문을 제거하고, 각 유틸리티 코드를 직접 포함시켜야 합니다.

**수정 방법**:

1. `scripts/utils/platform.js` 내용을 `scripts/content.js` 상단에 복사
2. `scripts/utils/stt.js` 내용을 그 아래에 복사
3. `scripts/utils/translator.js` 내용을 그 아래에 복사
4. export 키워드 모두 제거
5. import 문 모두 제거

또는 별도의 빌드 스크립트를 작성하여 자동으로 번들링할 수 있습니다.

---

## 🔧 디버깅

### Console 로그 확인

#### Background Service Worker
1. `chrome://extensions/` 접속
2. "Live Stream Translator" 찾기
3. "Service Worker" 링크 클릭
4. Console에서 로그 확인

#### Content Script
1. 스트리밍 페이지에서 F12 (개발자 도구)
2. Console 탭에서 로그 확인
3. "Live Stream Translator" 관련 로그 찾기

#### Popup
1. Extension 아이콘 우클릭
2. "팝업 검사" 클릭
3. Console에서 로그 확인

### 네트워크 요청 확인

1. F12 → Network 탭
2. 번역 API 요청 확인
3. 응답 상태 코드 확인 (200 OK 여부)

---

## 📊 성능 모니터링

### Chrome Task Manager

1. Shift+Esc (Windows) / Cmd+Option+Esc (Mac)
2. "Live Stream Translator" 항목 찾기
3. 메모리 사용량, CPU 사용률 확인

### 목표 성능
- 메모리: 50MB 이하
- CPU: 10% 이하
- 지연시간: 2초 이내

---

## ✅ 설치 완료 체크리스트

- [ ] 아이콘 파일 생성 완료
- [ ] Chrome Extension 로드 성공
- [ ] YouTube에서 정상 작동 확인
- [ ] Twitch에서 정상 작동 확인
- [ ] 설정 저장/불러오기 확인
- [ ] 번역 엔진 전환 확인
- [ ] 자막 위치 조정 확인
- [ ] 에러 없이 30분 이상 작동 확인

---

## 🎉 다음 단계

Extension이 정상 작동하면:

1. **기능 개선**
   - 추가 플랫폼 지원
   - 번역 품질 개선
   - UI/UX 개선

2. **Chrome Web Store 출시 준비**
   - 스크린샷 제작
   - 프로모션 이미지 제작
   - 개인정보 보호정책 작성
   - 상세 설명 작성

3. **피드백 수집**
   - 사용자 테스트
   - 버그 리포트
   - 기능 요청

---

문제가 발생하면 GitHub Issues에 보고해주세요!

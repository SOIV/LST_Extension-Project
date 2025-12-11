# 아이콘 파일

이 폴더에는 Chrome Extension의 아이콘 파일들이 필요합니다.

## 필요한 아이콘

### 기본 아이콘
- `icon16.png` - 16x16px
- `icon32.png` - 32x32px
- `icon48.png` - 48x48px
- `icon128.png` - 128x128px

### 활성 상태 아이콘 (선택사항)
- `icon16-active.png` - 16x16px (캡처 중일 때)
- `icon32-active.png` - 32x32px
- `icon48-active.png` - 48x48px
- `icon128-active.png` - 128x128px

## 아이콘 디자인 가이드

### 색상 테마
- **기본 상태**: 보라색 계열 (#667eea ~ #764ba2)
- **활성 상태**: 녹색 계열 (#4caf50) 또는 밝은 보라색

### 디자인 요소
- 자막 또는 말풍선 모양
- 언어 기호 (A↔한)
- 마이크 아이콘
- 지구본 (다국어)

### 도구
- [Figma](https://www.figma.com/) - 무료 디자인 도구
- [GIMP](https://www.gimp.org/) - 무료 이미지 편집
- [Canva](https://www.canva.com/) - 온라인 디자인 도구
- [Flaticon](https://www.flaticon.com/) - 무료 아이콘 다운로드

## 임시 아이콘 생성

개발 중에는 간단한 색상 아이콘을 사용할 수 있습니다:

```bash
# ImageMagick 사용 (설치 필요)
convert -size 16x16 xc:#667eea icon16.png
convert -size 32x32 xc:#667eea icon32.png
convert -size 48x48 xc:#667eea icon48.png
convert -size 128x128 xc:#667eea icon128.png

# 활성 상태
convert -size 16x16 xc:#4caf50 icon16-active.png
convert -size 32x32 xc:#4caf50 icon32-active.png
convert -size 48x48 xc:#4caf50 icon48-active.png
convert -size 128x128 xc:#4caf50 icon128-active.png
```

## 온라인 생성기

아이콘 생성을 도와주는 온라인 도구:
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/
- https://www.websiteplanet.com/webtools/favicon-generator/

아이콘을 생성한 후 이 폴더에 저장하세요.
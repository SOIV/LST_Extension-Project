# Extension Settings UI

Status: active

Chrome Extension 팝업과 플레이어 패널 설정 UI를 다룬다.

## Scope

- 커뮤니티 자막 on/off
- 자막 언어 선택
- 글꼴/색상/크기/배경/위치 설정
- 실시간 STT 관련 잠금/해제 예정 탭
- 플레이어 내부 패널과 팝업 설정 동기화

## 공통 자막 표시 설정 (현재 구현 + 예정)

### 현재 구현됨

| 설정 | 설명 |
|---|---|
| 글꼴 모음 (fontFamily) | Proportional Sans-Serif 등 YouTube 호환 글꼴 |
| 글꼴 색상 (fontColor) | white, yellow, green 등 |
| 글꼴 불투명도 (fontOpacity) | 0~100% |
| 글꼴 크기 (overlaySize) | 50~400% |
| 글자 테두리 스타일 (edgeStyle) | none, raised, depressed, uniform, drop-shadow |
| 배경 색상/불투명도 (bgColor, bgOpacity) | |
| 창 색상/불투명도 (windowColor, windowOpacity) | |

### 추가 예정

| 설정 | 설명 | 비고 |
|---|---|---|
| 텍스트 외곽선 (Text Outline) | `-webkit-text-stroke` 기반 획 테두리 | 현재 edgeStyle과 별개. 스트리밍 오버레이에서도 사용 |
| 텍스트 정렬 (Text Align) | left / center / right | 기본값 center. 스트리밍 오버레이 레이아웃 대응 용도로도 필요 |

#### Text Outline 구현 방향

현재 `edgeStyle`은 YouTube TextTrack CSS 규격(`text-shadow` 기반)이라 획 테두리 표현에 한계가 있다.
Text Outline은 CSS `-webkit-text-stroke`로 별도 구현하며 `edgeStyle`과 독립적으로 동작한다.

```css
/* 예시 */
.lst-subtitle {
  -webkit-text-stroke: 2px black;
}
```

- 획 두께: 슬라이더 (0~4px 범위 예상)
- 획 색상: 글꼴 색상 선택과 동일한 팔레트 사용
- 공통 설정에 포함하여 커뮤니티 자막과 실시간 자막 모두 적용

## Related Documents

- [Extension Overview](overview.md)
- [Community Subtitles](community-subtitles.md)
- [Realtime STT](realtime-stt.md)

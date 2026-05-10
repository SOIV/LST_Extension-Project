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

## Expert Options (고급 설정) - STT 관련

일반 사용자에게는 숨겨두고, 고급 사용자가 접근할 수 있는 세부 조정 항목.
참고: [Speech Translator](https://chromewebstore.google.com/detail/jodfjmaiakpnmeddgpeflpafebmlhppn) 확장 프로그램의 Expert Options 섹션

| 설정 | 기본값 (참고) | 설명 |
|---|---|---|
| Max letters per translation | 265 | 한 번에 번역할 최대 글자 수. 초과 시 강제 컷. [overlay-renderer.md 섹션 9~10](overlay-renderer.md) 참고 |
| Max letters (Streaming Mode) | 125 | 스트리밍 모드 활성 시 적용되는 별도 최대 글자 수 (더 짧게 끊어서 지연 최소화) |
| Delay between translations (ms) | 1000 | 연속 번역 요청 사이 최소 대기 시간. API 과호출 방지 및 자막 흔들림 감소 |
| Number of preserved final translations | 50 | 이전 자막 히스토리 보존 개수. 히스토리 표시 기능 및 컨텍스트 유지에 사용 |

### 배치 방향

- 팝업 UI에서는 기본 숨김 처리
- 전체 설정 페이지(새 탭)에서 접기/펼치기 패널로 제공 예정
- 실시간 탭 내 하단 또는 별도 "고급" 내부 탭으로 분리 검토

## Related Documents

- [Extension Overview](overview.md)
- [Community Subtitles](community-subtitles.md)
- [Realtime STT](realtime-stt.md)

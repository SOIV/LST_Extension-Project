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

### 추가 완료

| 설정 | 설명 | 비고 |
|---|---|---|
| 텍스트 외곽선 (Text Outline) | `edgeStyle`로 대체 완료 | YouTube도 `text-shadow` 기반 사용 — `-webkit-text-stroke` 별도 구현 불필요 |
| 텍스트 정렬 (Text Align) | left / center / right | STT 실시간 자막 전용. 기본값 center |

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

- 팝업에서 띄우기 힘든 항목은 새 탭(전체 설정 페이지)에서 제공
  - "띄우기 힘든 항목"은 Expert Options 같은 고급 설정뿐 아니라, 팝업의 좁은 공간에 넣기 애매한 일반 설정 일부도 포함될 수 있음
- 새 탭 설정 페이지에는 팝업에 있는 기본 설정들도 함께 노출하여, 한 곳에서 모든 설정을 다룰 수 있도록 함
- 팝업 UI에서는 고급 설정 기본 숨김 처리 유지 (빠른 접근용 축소판 역할)
- 실시간 탭 내 하단 또는 별도 "고급" 내부 탭으로 분리하는 방안은 추가 검토

## Related Documents

- [Extension Overview](overview.md)
- [Community Subtitles](community-subtitles.md)
- [Realtime STT](realtime-stt.md)

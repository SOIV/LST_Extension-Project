# 스트리밍 오버레이 (Streaming Overlay)

Status: planned

방송/녹화 소프트웨어(OBS 등)와 연동하거나, 자막만 단독으로 표시하는 전용 오버레이 창을 다룬다.

---

## 배경 및 목적

Speech Translator 등 유사 확장 프로그램에서 OBS 브라우저 소스 연동 기능을 제공하고 있으며,
LST에서도 스트리머 및 콘텐츠 크리에이터 대상으로 동일한 수요가 존재한다.

---

## 구현 단계

### Phase A — Extension 단독 오버레이 탭 (현재 구현 가능)

별도 서버 없이 Extension 내부에서 동작하는 전용 오버레이 창.

**동작 방식:**
```
Extension (팝업/콘텐츠 스크립트)
  → chrome.runtime.sendMessage
  → overlay.html (Extension 내부 페이지)
  → 자막 표시
```

**특징:**
- 서버 불필요
- `chrome-extension://[id]/overlay.html` URL로 접근
- OBS 브라우저 소스에서 직접 사용 불가 (chrome-extension:// 스킴 미지원)
- OBS 연동은 **윈도우 캡처**로 우회 가능

**구현 범위:**
- `overlay.html` + `scripts/overlay.js` 신규 생성
- `chrome.runtime.onMessage`로 자막 수신
- 자막만 표시되는 최소 UI (배경 투명, 텍스트만)
- 팝업에서 "오버레이 창 열기" 버튼 제공

---

### Phase B — Lite Helper 로컬 WebSocket 서버 (Desktop App 개발 후)

Lite Helper(Desktop App)가 로컬 WebSocket 서버를 실행하여 OBS 브라우저 소스와 직접 연동.

**동작 방식:**
```
Extension
  → WebSocket (ws://localhost:9001)
  ← Lite Helper (로컬 서버 역할)
  → OBS 브라우저 소스 (http://localhost:9001/overlay)
```

**특징:**
- OBS 브라우저 소스에서 `http://localhost:9001/overlay` 직접 사용 가능
- 외부 서버/클라우드 불필요, 완전 로컬 동작
- SAMMI, Touch Portal 등 유사 툴과 같은 패턴
- Lite Helper 실행 중일 때만 동작

**구현 범위 (Desktop App 쪽):**
- Lite Helper에 WebSocket 서버 모듈 추가 (포트: 9001 기본값, 설정 변경 가능)
- Extension에서 Lite Helper 감지 및 WebSocket 연결 로직 추가
- `http://localhost:9001/overlay` 에서 서빙되는 오버레이 HTML

**관련 문서:** [Extension Bridge](../30_desktop-app/extension-bridge.md)

---

### Phase C — 호스팅 오버레이 (검토 중, 낮은 우선순위)

플랫폼 서버를 경유하는 원격 오버레이.

**제약 조건:**
- 현재 플랫폼(Next.js / Vercel)은 서버리스 환경으로 **WebSocket 지원 불가**
- SSE(Server-Sent Events)도 Vercel 함수 제한(최대 60초)에 걸림
- 구현 시 Pusher, Ably 등 외부 실시간 서비스 또는 별도 WebSocket 서버 필요
- 부하 자체는 경미하나(텍스트 중계 수준) 인프라 복잡도가 올라감

**현재 결론:** Phase B(Lite Helper 로컬 서버)가 실현되면 Phase C의 필요성이 낮아짐. 보류.

---

## 오버레이 표시 설정

스트리밍 오버레이에서 추가로 필요한 표시 설정.
공통 설정(글꼴, 색상, 크기 등)은 [Settings UI](settings-ui.md) 참고.

| 설정 | 설명 | 공통 설정 포함 여부 |
|---|---|---|
| 텍스트 외곽선 (Text Outline) | 획 테두리, `-webkit-text-stroke` | ✅ 공통 설정에 포함 (스트리밍 오버레이에서도 동일 설정 사용) |
| 텍스트 정렬 (Center Text) | left / center / right 정렬 | ✅ 공통 설정에 포함 (기본값 center) |
| 배경 투명 모드 | 오버레이 창 배경 완전 투명 (OBS 크로마키 대응) | 오버레이 탭 전용 |
| 위치 고정 / 드래그 | 자막 위치를 드래그로 조정 | 오버레이 탭 전용 |

> Text Outline과 Center Text(텍스트 정렬)는 스트리밍 오버레이 전용이 아니라
> 모든 자막 표시에 공통 적용되므로 공통 설정에 포함한다.

---

## 우선순위 및 로드맵 위치

| Phase | 조건 | 로드맵 |
|---|---|---|
| Phase A (Extension 오버레이 탭) | Extension 단독, 즉시 구현 가능 | Phase 6 (실시간 STT) 내 포함 |
| Phase B (로컬 WebSocket) | Lite Helper 개발 완료 후 | Lite Helper 1차 릴리즈 이후 |
| Phase C (호스팅 오버레이) | 인프라 재검토 필요 | 보류 |

---

## 관련 문서

- [Extension Overview](overview.md)
- [Realtime STT](realtime-stt.md)
- [Extension Bridge](../30_desktop-app/extension-bridge.md)
- [Desktop App Modes](../30_desktop-app/app-modes.md)

# Desktop App Extension Bridge

Status: planned

Desktop App과 Chrome Extension의 연동 방식을 다룬다.

## Scope

- WebSocket 또는 로컬 브릿지
- Lite Helper 또는 Full Desktop App의 STT/번역 결과 전달
- Desktop AI runtime의 프리셋 기반 번역 결과 전달
- Extension 오버레이 표시 연동
- 연결 실패 시 fallback 정책

## 연결 원칙

- 엔진의 WebSocket 서버는 `127.0.0.1`에만 연다 (기본 포트 48000).
- 일반 웹페이지도 localhost WebSocket 접속을 시도할 수 있다. 그래서 `Origin`이 LST Extension(`chrome-extension://<확장 ID>`) 또는 Desktop 앱 화면인 연결만 받고, 연결 토큰도 확인한다.
- 토큰을 Extension에 전달하는 방식(페어링)은 메시지 규칙과 함께 정한다.
- Chrome Extension과 Desktop 앱 화면(Lite Helper / Full Desktop App)은 같은 메시지 규칙을 쓴다.

## 메시지 규칙 (구현 첫 단계)

- 메시지 종류, 필드, 버전 표시를 확정하는 것이 Desktop 구현의 첫 단계다.
- 이 규칙이 유지되면 엔진 내부 구현이 바뀌어도(예: 일부 기능을 Rust로 전환) Extension과 앱 화면은 그대로 둘 수 있다.
- 현재 [Desktop App Overview](overview.md)의 메시지 예시는 초안이다.

## Related Documents

- [Desktop App Overview](overview.md)
- [Desktop App Modes](app-modes.md)
- [Desktop STT Runtime](stt-runtime.md)
- [Desktop AI Runtime](ai-runtime.md)
- [Extension Realtime STT](../10_extension/realtime-stt.md)

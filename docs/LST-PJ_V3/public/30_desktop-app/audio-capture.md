# Desktop App Audio Capture

Status: planned

Desktop App의 시스템 오디오 캡처 기능을 다룬다.

## Scope

- Windows WASAPI Loopback (우선 지원)
- macOS 시스템 오디오 캡처 (후순위)
- 입력 장치 선택
- 캡처된 오디오를 Desktop STT runtime 또는 Extension bridge로 전달

## 구현 위치

오디오 캡처는 Python 엔진 안에서 처리한다.
Windows WASAPI Loopback은 Python 라이브러리(예: PyAudioWPatch, soundcard)로 처리할 수 있다.

## macOS (후순위)

- macOS에는 Windows의 WASAPI Loopback 같은 오래된 표준 방법이 없다.
- macOS 14.2+의 Core Audio Tap, macOS 13+의 ScreenCaptureKit으로 가상 장치 없이 시스템 오디오를 받을 수 있다. 다만 Apple 네이티브 API라 Python만으로는 어렵고, Swift나 Rust로 만든 작은 캡처 프로그램이 필요하다.
- 처음 실행 시 시스템 오디오 녹음 권한을 받아야 한다.
- 네이티브 캡처를 넣기 전까지는 BlackHole 같은 가상 오디오 장치나 마이크 입력으로 대응한다.

## Related Documents

- [Desktop App Overview](overview.md)
- [Desktop App Modes](app-modes.md)
- [Desktop STT Runtime](stt-runtime.md)

---
sidebar_position: 1
slug: /
---

# Live Stream Translator Project 사용자 문서

LST Project는 브라우저 탭 오디오 또는 마이크 음성을 인식해 실시간 자막과 번역을 표시하는 STT 기반 Chrome 확장 프로그램입니다.

이 문서는 베타 사용자를 위한 초기 가이드입니다. 현재 문서는 공개 가능한 사용자 안내만 포함하며, 내부 기획 문서나 민감 초안은 포함하지 않습니다.

## 빠른 시작

1. Chrome 확장 프로그램을 설치합니다.
2. YouTube 영상 또는 라이브 페이지를 엽니다.
3. 확장 팝업에서 API 키를 설정합니다.
4. 실시간 자막 탭에서 오디오 소스와 STT 엔진을 선택합니다.
5. `START LISTENING` 버튼으로 실시간 자막을 시작합니다.

## 현재 권장 경로

베타에서는 탭 오디오 + OpenAI Transcription API 조합을 우선 권장합니다.

Web Speech API와 Realtime API는 사용할 수 있지만, 브라우저 환경과 VAD 설정에 따라 결과가 달라질 수 있습니다.

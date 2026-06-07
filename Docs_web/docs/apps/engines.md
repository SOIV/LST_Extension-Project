---
sidebar_position: 5
---

# 엔진 선택 가이드

## STT 엔진

### OpenAI Transcription API

v1.0.0 준비 단계에서 가장 안정적인 기본 선택지입니다. 발화 단위로 자막을 생성하는 흐름에 적합합니다.

### OpenAI Realtime API

낮은 지연 시간이 필요할 때 사용할 수 있습니다. 현재 VAD와 중간 번역 표시가 조정 중이므로 결과가 불안정할 수 있습니다.

해당 엔진은 발화 단위로 자막을 생성하지 않습니다. 실시간으로 자막을 생성하는 방식입니다.

### Web Speech API

브라우저 내장 음성 인식 기능입니다. 별도 STT API 키가 필요하지 않지만, 브라우저와 언어 설정에 크게 영향을 받습니다.

해당 엔진은 발화 단위로 자막을 생성하지 않습니다. 실시간으로 자막을 생성하는 방식입니다.

## 번역 엔진

### Google Translate

별도 키 없이 무료로 사용할 수 있는 기본 번역 엔진입니다.

### Google Apps Script

사용자가 직접 배포한 Apps Script 웹 앱을 번역 프록시로 사용하는 방식입니다.

Apps Script를 통하여 개인의 Google Translate을 사용하는 방법입니다.

### Papago

Naver Cloud Platform 키가 필요합니다.

### DeepL

DeepL API 키가 필요합니다. 고품질 번역이 필요한 경우 선택할 수 있습니다.

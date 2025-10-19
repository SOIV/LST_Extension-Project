/**
 * Live Stream Translator - Content Script
 * 실시간 오디오 캡처, STT, 번역, 자막 오버레이
 */

import { detectPlatform, getPlatformConfig, getSubtitlePosition, translateSlang, logPlatformInfo } from './utils/platform.js';
import { SpeechRecognitionEngine, STTResultHandler, getLanguageCode, isWebSpeechSupported } from './utils/stt.js';
import { translate, clearCache, getCacheSize } from './utils/translator.js';

/**
 * Live Stream Translator 메인 클래스
 */
class LiveStreamTranslator {
  constructor() {
    this.platformId = null;
    this.platformConfig = null;
    this.isCapturing = false;
    this.audioContext = null;
    this.mediaStream = null;
    this.sttEngine = null;
    this.sttResultHandler = null;
    this.overlayContainer = null;
    this.settings = null;
    this.currentSubtitle = null;
  }

  /**
   * 초기화
   */
  async init() {
    console.log('=== Live Stream Translator Content Script ===');

    // 플랫폼 감지
    const platformInfo = logPlatformInfo();
    this.platformId = platformInfo.platformId;
    this.platformConfig = platformInfo.config;

    if (!this.platformConfig) {
      console.warn('Unknown platform, translator disabled');
      return false;
    }

    // 설정 로드
    await this.loadSettings();

    // Web Speech API 지원 확인
    if (!isWebSpeechSupported()) {
      console.error('Web Speech API not supported');
      this.showNotification('이 브라우저는 Web Speech API를 지원하지 않습니다.', 'error');
      return false;
    }

    // STT 엔진 초기화
    this.sttResultHandler = new STTResultHandler();

    console.log('Live Stream Translator initialized successfully');
    return true;
  }

  /**
   * 설정 로드
   */
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (settings) => {
        this.settings = {
          sourceLang: settings.sourceLang || 'auto',
          targetLang: settings.targetLang || 'ko',
          translationEngine: settings.translationEngine || 'google',
          showOriginal: settings.showOriginal !== false,
          overlayPosition: settings.overlayPosition || 'bottom',
          overlaySize: settings.overlaySize || '100',
          enableCache: settings.enableCache !== false,
          apiKey: settings.apiKey || '',
          apiSecret: settings.apiSecret || ''
        };

        console.log('Settings loaded:', this.settings);
        resolve(this.settings);
      });
    });
  }

  /**
   * 오디오 캡처 시작
   */
  async startCapture(streamId) {
    if (this.isCapturing) {
      console.warn('Already capturing');
      return;
    }

    try {
      console.log('Starting audio capture with streamId:', streamId);

      // MediaStream 획득
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        }
      });

      console.log('MediaStream obtained:', this.mediaStream);

      // AudioContext 생성 및 재생 (음소거 방지)
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.audioContext.destination);

      console.log('Audio playback connected');

      // STT 시작
      this.startSpeechRecognition();

      // 오버레이 UI 생성
      this.createOverlay();

      this.isCapturing = true;

      // Background에 알림
      chrome.runtime.sendMessage({ action: 'captureStarted' });

      this.showNotification('실시간 번역이 시작되었습니다.', 'success');

      console.log('Audio capture started successfully');
    } catch (error) {
      console.error('Failed to start capture:', error);
      this.showNotification(`캡처 시작 실패: ${error.message}`, 'error');

      // Background에 에러 알림
      chrome.runtime.sendMessage({
        action: 'captureError',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * 음성 인식 시작
   */
  startSpeechRecognition() {
    const lang = getLanguageCode(this.settings.sourceLang);

    this.sttEngine = new SpeechRecognitionEngine({
      lang: lang === 'auto' ? undefined : lang,
      continuous: true,
      interimResults: true,
      autoRestart: true
    });

    // 결과 처리
    this.sttEngine.onResult = async (results) => {
      const processed = this.sttResultHandler.handleResults(results);

      // Final 결과가 있으면 번역
      if (processed.hasNew && processed.final.length > 0) {
        for (const result of processed.final) {
          await this.translateAndDisplay(result.transcript, true);
        }
      }

      // Interim 결과 표시 (번역 없이)
      if (processed.interim.length > 0) {
        const latestInterim = processed.interim[processed.interim.length - 1];
        this.displaySubtitle(latestInterim.transcript, '', false);
      }
    };

    // 에러 처리
    this.sttEngine.onError = (error) => {
      console.error('STT Error:', error);
      this.showNotification(`음성 인식 오류: ${error.message}`, 'error');
    };

    // 종료 처리
    this.sttEngine.onEnd = () => {
      console.log('STT ended');
    };

    this.sttEngine.start();
    console.log('Speech recognition started');
  }

  /**
   * 번역 및 표시
   */
  async translateAndDisplay(text, isFinal) {
    try {
      // 플랫폼 속어 번역
      let processedText = translateSlang(text, this.platformId);

      // 번역 실행
      const translatedText = await translate(
        processedText,
        this.settings.sourceLang,
        this.settings.targetLang,
        {
          engine: this.settings.translationEngine,
          apiKey: this.settings.apiKey,
          apiSecret: this.settings.apiSecret
        }
      );

      // 자막 표시
      this.displaySubtitle(processedText, translatedText, isFinal);

      console.log(`Translated: "${processedText}" -> "${translatedText}"`);
    } catch (error) {
      console.error('Translation error:', error);
      // 번역 실패 시 원문만 표시
      this.displaySubtitle(text, `[번역 실패: ${error.message}]`, isFinal);
    }
  }

  /**
   * 자막 표시
   */
  displaySubtitle(original, translated, isFinal) {
    if (!this.overlayContainer) {
      this.createOverlay();
    }

    // 기존 자막 제거
    if (this.currentSubtitle) {
      this.currentSubtitle.remove();
    }

    // 새 자막 생성
    const subtitleDiv = document.createElement('div');
    subtitleDiv.className = `lst-subtitle ${isFinal ? 'final' : 'interim'}`;

    // 원문 표시 여부
    if (this.settings.showOriginal && original) {
      const originalSpan = document.createElement('div');
      originalSpan.className = 'lst-subtitle-original';
      originalSpan.textContent = original;
      subtitleDiv.appendChild(originalSpan);
    }

    // 번역문
    if (translated) {
      const translatedSpan = document.createElement('div');
      translatedSpan.className = 'lst-subtitle-translated';
      translatedSpan.textContent = translated;
      subtitleDiv.appendChild(translatedSpan);
    } else if (original) {
      // 번역문이 없으면 원문만
      const textSpan = document.createElement('div');
      textSpan.className = 'lst-subtitle-text';
      textSpan.textContent = original;
      subtitleDiv.appendChild(textSpan);
    }

    this.overlayContainer.appendChild(subtitleDiv);
    this.currentSubtitle = subtitleDiv;

    // Final 자막은 3초 후 페이드아웃
    if (isFinal) {
      setTimeout(() => {
        subtitleDiv.classList.add('fade-out');
        setTimeout(() => {
          if (subtitleDiv.parentNode) {
            subtitleDiv.remove();
          }
        }, 500);
      }, 3000);
    }
  }

  /**
   * 오버레이 UI 생성
   */
  createOverlay() {
    if (this.overlayContainer) {
      return;
    }

    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'lst-overlay-container';
    this.overlayContainer.className = `lst-overlay platform-${this.platformId}`;

    // 자막 크기 클래스 추가 (퍼센트 기반)
    this.overlayContainer.setAttribute('data-size', this.settings.overlaySize);

    // 플랫폼별 위치 적용
    const position = getSubtitlePosition(this.platformId);
    Object.assign(this.overlayContainer.style, position);

    document.body.appendChild(this.overlayContainer);

    console.log('Overlay created at position:', position);
  }

  /**
   * 오버레이 제거
   */
  removeOverlay() {
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
      this.currentSubtitle = null;
    }
  }

  /**
   * 캡처 중지
   */
  stopCapture() {
    console.log('Stopping capture...');

    // STT 중지
    if (this.sttEngine) {
      this.sttEngine.stop();
      this.sttEngine = null;
    }

    // AudioContext 정리
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // MediaStream 정리
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // 오버레이 제거
    this.removeOverlay();

    this.isCapturing = false;

    // Background에 알림
    chrome.runtime.sendMessage({ action: 'captureStopped' });

    this.showNotification('실시간 번역이 중지되었습니다.', 'info');

    console.log('Capture stopped');
  }

  /**
   * 알림 표시
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `lst-notification lst-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // 3초 후 제거
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
}

// 전역 인스턴스
let translatorInstance = null;

/**
 * Extension 초기화
 */
(async function() {
  translatorInstance = new LiveStreamTranslator();
  await translatorInstance.init();
})();

/**
 * Background로부터 메시지 수신
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);

  switch (message.action) {
    case 'startCapture':
      if (message.streamId) {
        translatorInstance.startCapture(message.streamId)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 비동기 응답
      }
      break;

    case 'stopCapture':
      translatorInstance.stopCapture();
      sendResponse({ success: true });
      break;

    case 'updateSettings':
      translatorInstance.loadSettings()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return false;
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  if (translatorInstance && translatorInstance.isCapturing) {
    translatorInstance.stopCapture();
  }
});

console.log('Live Stream Translator Content Script loaded');

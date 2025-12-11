/**
 * Live Stream Translator - Content Script (Bundled Version)
 * ES6 모듈을 사용할 수 없으므로 모든 코드를 하나의 파일로 통합
 */

// ============================================================================
// Platform Detection Utility
// ============================================================================

const PLATFORMS = {
  YOUTUBE: 'youtube',
  YOUTUBE_LIVE: 'youtube_live',
  TWITCH: 'twitch',
  SOOP: 'soop',
  CHZZK: 'chzzk',
  NICONICO: 'niconico',
  UNKNOWN: 'unknown'
};

const platformConfigs = {
  [PLATFORMS.YOUTUBE]: {
    name: 'YouTube',
    urlPattern: /^https?:\/\/(www\.)?youtube\.com\/watch/,
    videoSelector: 'video.html5-main-video',
    liveSelector: '.ytp-live-badge',
    subtitlePosition: { bottom: '100px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'auto',
    bufferSize: 1024,
    useYouTubeAPI: true
  },
  [PLATFORMS.YOUTUBE_LIVE]: {
    name: 'YouTube Live',
    urlPattern: /^https?:\/\/(www\.)?youtube\.com\/(watch|live)/,
    videoSelector: 'video.html5-main-video',
    liveSelector: '.ytp-live-badge',
    subtitlePosition: { bottom: '100px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'auto',
    bufferSize: 1024,
    useYouTubeAPI: true
  },
  [PLATFORMS.TWITCH]: {
    name: 'Twitch',
    urlPattern: /^https?:\/\/(www\.)?twitch\.tv\/\w+/,
    videoSelector: 'video[class*="video-player"]',
    liveSelector: '[data-a-target="player-overlay-click-handler"]',
    subtitlePosition: { bottom: '80px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'en',
    bufferSize: 512,
    slangDict: {
      'Kappa': '냉소',
      'PogChamp': '대박',
      'LUL': 'ㅋㅋㅋ',
      'monkaS': '불안',
      'KEKW': 'ㅋㅋㅋㅋ'
    }
  },
  [PLATFORMS.SOOP]: {
    name: 'SOOP (구 아프리카TV)',
    urlPattern: /^https?:\/\/play\.sooplive\.co\.kr\//,
    videoSelector: 'video',
    liveSelector: '.live_badge',
    subtitlePosition: { bottom: '90px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'ko',
    bufferSize: 1024,
    slangDict: {
      '컨텐츠': '방송',
      'ㄱㄱ': '고고',
      'ㄷㄷ': '덜덜',
      'ㅇㅇ': '응응'
    }
  },
  [PLATFORMS.CHZZK]: {
    name: '치지직',
    urlPattern: /^https?:\/\/chzzk\.naver\.com\/live\//,
    videoSelector: 'video',
    liveSelector: '.live_state',
    subtitlePosition: { bottom: '90px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'ko',
    bufferSize: 1024,
    slangDict: {
      'ㄱㄱ': '고고',
      'ㄷㄷ': '덜덜',
      'ㅇㅇ': '응응'
    }
  },
  [PLATFORMS.NICONICO]: {
    name: 'ニコニコ動画',
    urlPattern: /^https?:\/\/(www\.|live\.)?nicovideo\.jp\//,
    videoSelector: 'video',
    liveSelector: '.PlayerStatusContainer',
    subtitlePosition: { bottom: '120px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'ja',
    bufferSize: 2048,
    slangDict: {
      'www': 'ㅋㅋㅋ',
      'wwww': 'ㅋㅋㅋㅋ',
      '草': 'ㅋㅋ',
      '888': '박수',
      'うぽつ': '업로드 감사'
    }
  }
};

function detectPlatform() {
  const url = window.location.href;

  if (platformConfigs[PLATFORMS.YOUTUBE].urlPattern.test(url)) {
    const liveBadge = document.querySelector(platformConfigs[PLATFORMS.YOUTUBE].liveSelector);
    if (liveBadge) {
      return PLATFORMS.YOUTUBE_LIVE;
    }
    return PLATFORMS.YOUTUBE;
  }

  for (const [platformId, config] of Object.entries(platformConfigs)) {
    if (platformId === PLATFORMS.YOUTUBE || platformId === PLATFORMS.YOUTUBE_LIVE) {
      continue;
    }
    if (config.urlPattern.test(url)) {
      return platformId;
    }
  }

  return PLATFORMS.UNKNOWN;
}

function getPlatformConfig(platformId) {
  return platformConfigs[platformId] || null;
}

function getSubtitlePosition(platformId) {
  const config = getPlatformConfig(platformId);
  if (!config) {
    return { bottom: '100px', left: '50%', transform: 'translateX(-50%)' };
  }
  return config.subtitlePosition;
}

function translateSlang(text, platformId) {
  const config = getPlatformConfig(platformId);
  if (!config || !config.slangDict) return text;

  let translatedText = text;
  for (const [slang, translation] of Object.entries(config.slangDict)) {
    const regex = new RegExp(slang, 'gi');
    translatedText = translatedText.replace(regex, translation);
  }

  return translatedText;
}

function logPlatformInfo() {
  const platformId = detectPlatform();
  const config = getPlatformConfig(platformId);

  console.log('=== Live Stream Translator - Platform Info ===');
  console.log('Platform:', config?.name || 'Unknown');
  console.log('URL:', window.location.href);
  console.log('Config:', config);
  console.log('=============================================');

  return { platformId, config };
}

// ============================================================================
// STT (Speech-to-Text) Engine
// ============================================================================

const LANGUAGE_CODES = {
  'auto': 'auto',
  'ko': 'ko-KR',
  'en': 'en-US',
  'ja': 'ja-JP',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'it': 'it-IT',
  'pt': 'pt-PT',
  'ru': 'ru-RU'
};

function getLanguageCode(lang) {
  return LANGUAGE_CODES[lang] || lang;
}

function isWebSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

class SpeechRecognitionEngine {
  constructor(options = {}) {
    this.options = {
      lang: options.lang || 'auto',
      continuous: options.continuous !== false,
      interimResults: options.interimResults !== false,
      maxAlternatives: options.maxAlternatives || 1,
      ...options
    };

    this.recognition = null;
    this.isRecognizing = false;
    this.onResult = null;
    this.onError = null;
    this.onEnd = null;
    this.autoRestart = options.autoRestart !== false;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Web Speech API is not supported in this browser');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.options.continuous;
    this.recognition.interimResults = this.options.interimResults;
    this.recognition.maxAlternatives = this.options.maxAlternatives;

    if (this.options.lang && this.options.lang !== 'auto') {
      this.recognition.lang = this.options.lang;
    }

    this.setupEventListeners();

    console.log('Speech Recognition initialized:', {
      lang: this.recognition.lang,
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults
    });
  }

  setupEventListeners() {
    this.recognition.onresult = (event) => {
      const results = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        const isFinal = result.isFinal;

        results.push({
          transcript,
          confidence,
          isFinal,
          timestamp: Date.now()
        });

        console.log(`[STT ${isFinal ? 'FINAL' : 'INTERIM'}]:`, transcript, `(${(confidence * 100).toFixed(1)}%)`);
      }

      if (this.onResult) {
        this.onResult(results);
      }
    };

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isRecognizing = true;
      this.restartAttempts = 0;
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isRecognizing = false;

      if (this.onEnd) {
        this.onEnd();
      }

      if (this.autoRestart && this.restartAttempts < this.maxRestartAttempts) {
        console.log(`Auto-restarting recognition (attempt ${this.restartAttempts + 1}/${this.maxRestartAttempts})...`);
        this.restartAttempts++;
        setTimeout(() => this.start(), 100);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);

      switch (event.error) {
        case 'no-speech':
          console.log('No speech detected, continuing...');
          break;

        case 'audio-capture':
          console.error('Audio capture failed');
          if (this.onError) {
            this.onError(new Error('마이크 또는 오디오 캡처에 접근할 수 없습니다.'));
          }
          break;

        case 'not-allowed':
          console.error('Permission denied');
          if (this.onError) {
            this.onError(new Error('음성 인식 권한이 거부되었습니다.'));
          }
          this.autoRestart = false;
          break;

        case 'network':
          console.error('Network error');
          if (this.onError) {
            this.onError(new Error('네트워크 오류가 발생했습니다.'));
          }
          break;

        case 'aborted':
          console.log('Recognition aborted');
          break;

        default:
          console.error('Unknown error:', event.error);
          if (this.onError) {
            this.onError(new Error(`음성 인식 오류: ${event.error}`));
          }
      }
    };
  }

  start() {
    if (!this.recognition) {
      this.init();
    }

    if (this.isRecognizing) {
      console.warn('Speech recognition is already running');
      return;
    }

    try {
      this.recognition.start();
      console.log('Starting speech recognition...');
    } catch (error) {
      console.error('Failed to start recognition:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  stop() {
    if (!this.recognition || !this.isRecognizing) {
      return;
    }

    this.autoRestart = false;
    this.recognition.stop();
    console.log('Stopping speech recognition...');
  }

  abort() {
    if (!this.recognition) {
      return;
    }

    this.autoRestart = false;
    this.recognition.abort();
    this.isRecognizing = false;
    console.log('Speech recognition aborted');
  }

  setLanguage(lang) {
    this.options.lang = lang;
    if (this.recognition && lang !== 'auto') {
      this.recognition.lang = lang;
      console.log('Language changed to:', lang);
    }
  }

  isActive() {
    return this.isRecognizing;
  }
}

class STTResultHandler {
  constructor() {
    this.lastFinalTranscript = '';
    this.lastInterimTranscript = '';
    this.transcriptHistory = [];
    this.maxHistorySize = 100;
  }

  handleResults(results) {
    const processedResults = {
      final: [],
      interim: [],
      hasNew: false
    };

    for (const result of results) {
      if (result.isFinal) {
        if (result.transcript !== this.lastFinalTranscript) {
          processedResults.final.push(result);
          this.lastFinalTranscript = result.transcript;
          processedResults.hasNew = true;

          this.addToHistory(result);
        }
      } else {
        processedResults.interim.push(result);
        this.lastInterimTranscript = result.transcript;
      }
    }

    return processedResults;
  }

  addToHistory(result) {
    this.transcriptHistory.push({
      transcript: result.transcript,
      confidence: result.confidence,
      timestamp: result.timestamp
    });

    if (this.transcriptHistory.length > this.maxHistorySize) {
      this.transcriptHistory.shift();
    }
  }

  clearHistory() {
    this.transcriptHistory = [];
    this.lastFinalTranscript = '';
    this.lastInterimTranscript = '';
  }
}

// ============================================================================
// Translation Engine
// ============================================================================

class TranslationCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }

  getSize() {
    return this.cache.size;
  }
}

const translationCache = new TranslationCache();

async function translateWithGoogle(text, sourceLang, targetLang) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data[0]) {
      const translatedText = data[0]
        .map(item => item[0])
        .filter(Boolean)
        .join('');

      return translatedText;
    }

    throw new Error('Invalid response from Google Translate');
  } catch (error) {
    console.error('Google Translate error:', error);
    throw error;
  }
}

async function translate(text, sourceLang = 'auto', targetLang = 'ko', options = {}) {
  if (!text || text.trim() === '') {
    return '';
  }

  const cacheKey = `${text}|${sourceLang}|${targetLang}|${options.engine || 'google'}`;

  if (translationCache.has(cacheKey)) {
    console.log('Translation cache hit:', text.substring(0, 30));
    return translationCache.get(cacheKey);
  }

  try {
    const translatedText = await translateWithGoogle(text, sourceLang, targetLang);
    translationCache.set(cacheKey, translatedText);
    console.log(`Translated:`, text.substring(0, 30), '->', translatedText.substring(0, 30));
    return translatedText;
  } catch (error) {
    console.error(`Translation failed:`, error);
    throw error;
  }
}

// ============================================================================
// Main Live Stream Translator Class
// ============================================================================

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

  async init() {
    console.log('=== Live Stream Translator Content Script ===');

    const platformInfo = logPlatformInfo();
    this.platformId = platformInfo.platformId;
    this.platformConfig = platformInfo.config;

    if (!this.platformConfig) {
      console.warn('Unknown platform, translator disabled');
      return false;
    }

    await this.loadSettings();

    if (!isWebSpeechSupported()) {
      console.error('Web Speech API not supported');
      this.showNotification('이 브라우저는 Web Speech API를 지원하지 않습니다.', 'error');
      return false;
    }

    this.sttResultHandler = new STTResultHandler();

    console.log('Live Stream Translator initialized successfully');
    return true;
  }

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

  async startCapture(streamId) {
    if (this.isCapturing) {
      console.warn('Already capturing');
      return;
    }

    try {
      console.log('Starting audio capture with streamId:', streamId);

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        }
      });

      console.log('MediaStream obtained:', this.mediaStream);

      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.audioContext.destination);

      console.log('Audio playback connected');

      this.startSpeechRecognition();
      this.createOverlay();

      this.isCapturing = true;

      chrome.runtime.sendMessage({ action: 'captureStarted' });

      this.showNotification('실시간 번역이 시작되었습니다.', 'success');

      console.log('Audio capture started successfully');
    } catch (error) {
      console.error('Failed to start capture:', error);
      this.showNotification(`캡처 시작 실패: ${error.message}`, 'error');

      chrome.runtime.sendMessage({
        action: 'captureError',
        error: error.message
      });

      throw error;
    }
  }

  startSpeechRecognition() {
    const lang = getLanguageCode(this.settings.sourceLang);

    this.sttEngine = new SpeechRecognitionEngine({
      lang: lang === 'auto' ? undefined : lang,
      continuous: true,
      interimResults: true,
      autoRestart: true
    });

    this.sttEngine.onResult = async (results) => {
      const processed = this.sttResultHandler.handleResults(results);

      if (processed.hasNew && processed.final.length > 0) {
        for (const result of processed.final) {
          await this.translateAndDisplay(result.transcript, true);
        }
      }

      if (processed.interim.length > 0) {
        const latestInterim = processed.interim[processed.interim.length - 1];
        this.displaySubtitle(latestInterim.transcript, '', false);
      }
    };

    this.sttEngine.onError = (error) => {
      console.error('STT Error:', error);
      this.showNotification(`음성 인식 오류: ${error.message}`, 'error');
    };

    this.sttEngine.onEnd = () => {
      console.log('STT ended');
    };

    this.sttEngine.start();
    console.log('Speech recognition started');
  }

  async translateAndDisplay(text, isFinal) {
    try {
      let processedText = translateSlang(text, this.platformId);

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

      this.displaySubtitle(processedText, translatedText, isFinal);

      console.log(`Translated: "${processedText}" -> "${translatedText}"`);
    } catch (error) {
      console.error('Translation error:', error);
      this.displaySubtitle(text, `[번역 실패: ${error.message}]`, isFinal);
    }
  }

  displaySubtitle(original, translated, isFinal) {
    if (!this.overlayContainer) {
      this.createOverlay();
    }

    if (this.currentSubtitle) {
      this.currentSubtitle.remove();
    }

    const subtitleDiv = document.createElement('div');
    subtitleDiv.className = `lst-subtitle ${isFinal ? 'final' : 'interim'}`;

    if (this.settings.showOriginal && original) {
      const originalSpan = document.createElement('div');
      originalSpan.className = 'lst-subtitle-original';
      originalSpan.textContent = original;
      subtitleDiv.appendChild(originalSpan);
    }

    if (translated) {
      const translatedSpan = document.createElement('div');
      translatedSpan.className = 'lst-subtitle-translated';
      translatedSpan.textContent = translated;
      subtitleDiv.appendChild(translatedSpan);
    } else if (original) {
      const textSpan = document.createElement('div');
      textSpan.className = 'lst-subtitle-text';
      textSpan.textContent = original;
      subtitleDiv.appendChild(textSpan);
    }

    this.overlayContainer.appendChild(subtitleDiv);
    this.currentSubtitle = subtitleDiv;

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

  createOverlay() {
    if (this.overlayContainer) {
      return;
    }

    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'lst-overlay-container';
    this.overlayContainer.className = `lst-overlay platform-${this.platformId}`;

    const position = getSubtitlePosition(this.platformId);
    Object.assign(this.overlayContainer.style, position);

    document.body.appendChild(this.overlayContainer);

    console.log('Overlay created at position:', position);
  }

  removeOverlay() {
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
      this.currentSubtitle = null;
    }
  }

  stopCapture() {
    console.log('Stopping capture...');

    if (this.sttEngine) {
      this.sttEngine.stop();
      this.sttEngine = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.removeOverlay();

    this.isCapturing = false;

    chrome.runtime.sendMessage({ action: 'captureStopped' });

    this.showNotification('실시간 번역이 중지되었습니다.', 'info');

    console.log('Capture stopped');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `lst-notification lst-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
}

// ============================================================================
// Initialization
// ============================================================================

let translatorInstance = null;

(async function() {
  translatorInstance = new LiveStreamTranslator();
  await translatorInstance.init();
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);

  switch (message.action) {
    case 'startCapture':
      if (message.streamId) {
        translatorInstance.startCapture(message.streamId)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
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

    case 'checkWebSpeech':
      sendResponse({ supported: isWebSpeechSupported() });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return false;
});

window.addEventListener('beforeunload', () => {
  if (translatorInstance && translatorInstance.isCapturing) {
    translatorInstance.stopCapture();
  }
});

console.log('Live Stream Translator Content Script loaded');

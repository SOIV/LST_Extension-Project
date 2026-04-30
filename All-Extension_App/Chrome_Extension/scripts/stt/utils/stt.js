/**
 * Speech-to-Text (STT) Engine Utility
 * Web Speech API 기반 실시간 음성 인식
 */

export const STT_ENGINES = {
  WEB_SPEECH: 'web_speech',
  GOOGLE_CLOUD: 'google_cloud'
};

/**
 * Web Speech API 래퍼 클래스
 */
export class SpeechRecognitionEngine {
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

  /**
   * 음성 인식 초기화
   */
  init() {
    // Web Speech API 지원 확인
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Web Speech API is not supported in this browser');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.options.continuous;
    this.recognition.interimResults = this.options.interimResults;
    this.recognition.maxAlternatives = this.options.maxAlternatives;

    // 언어 설정
    if (this.options.lang && this.options.lang !== 'auto') {
      this.recognition.lang = this.options.lang;
    }

    // 이벤트 리스너 등록
    this.setupEventListeners();

    console.log('Speech Recognition initialized:', {
      lang: this.recognition.lang,
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults
    });
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 음성 인식 결과
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

    // 음성 인식 시작
    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isRecognizing = true;
      this.restartAttempts = 0;
    };

    // 음성 인식 종료
    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isRecognizing = false;

      if (this.onEnd) {
        this.onEnd();
      }

      // 자동 재시작
      if (this.autoRestart && this.restartAttempts < this.maxRestartAttempts) {
        console.log(`Auto-restarting recognition (attempt ${this.restartAttempts + 1}/${this.maxRestartAttempts})...`);
        this.restartAttempts++;
        setTimeout(() => this.start(), 100);
      }
    };

    // 에러 처리
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);

      // 에러 타입별 처리
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

    // 음성 감지 시작
    this.recognition.onspeechstart = () => {
      console.log('Speech detected');
    };

    // 음성 감지 종료
    this.recognition.onspeechend = () => {
      console.log('Speech ended');
    };
  }

  /**
   * 음성 인식 시작
   */
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

  /**
   * 음성 인식 중지
   */
  stop() {
    if (!this.recognition || !this.isRecognizing) {
      return;
    }

    this.autoRestart = false;
    this.recognition.stop();
    console.log('Stopping speech recognition...');
  }

  /**
   * 음성 인식 중단 (즉시)
   */
  abort() {
    if (!this.recognition) {
      return;
    }

    this.autoRestart = false;
    this.recognition.abort();
    this.isRecognizing = false;
    console.log('Speech recognition aborted');
  }

  /**
   * 언어 변경
   */
  setLanguage(lang) {
    this.options.lang = lang;
    if (this.recognition && lang !== 'auto') {
      this.recognition.lang = lang;
      console.log('Language changed to:', lang);
    }
  }

  /**
   * 상태 확인
   */
  isActive() {
    return this.isRecognizing;
  }
}

/**
 * 언어 코드 매핑
 */
export const LANGUAGE_CODES = {
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
  'ru': 'ru-RU',
  'ar': 'ar-SA',
  'hi': 'hi-IN',
  'th': 'th-TH',
  'vi': 'vi-VN',
  'id': 'id-ID'
};

/**
 * 언어 코드 변환
 */
export function getLanguageCode(lang) {
  return LANGUAGE_CODES[lang] || lang;
}

/**
 * 지원 언어 확인
 */
export function isSupportedLanguage(lang) {
  return Object.keys(LANGUAGE_CODES).includes(lang);
}

/**
 * 브라우저 지원 확인
 */
export function isWebSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * 음성 인식 설정 검증
 */
export function validateSTTOptions(options) {
  const errors = [];

  if (!isWebSpeechSupported()) {
    errors.push('Web Speech API is not supported in this browser');
  }

  if (options.lang && options.lang !== 'auto' && !isSupportedLanguage(options.lang)) {
    errors.push(`Language '${options.lang}' is not supported`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 음성 인식 결과 처리 헬퍼
 */
export class STTResultHandler {
  constructor() {
    this.lastFinalTranscript = '';
    this.lastInterimTranscript = '';
    this.transcriptHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * 결과 처리
   */
  handleResults(results) {
    const processedResults = {
      final: [],
      interim: [],
      hasNew: false
    };

    for (const result of results) {
      if (result.isFinal) {
        // Final 결과만 저장
        if (result.transcript !== this.lastFinalTranscript) {
          processedResults.final.push(result);
          this.lastFinalTranscript = result.transcript;
          processedResults.hasNew = true;

          // 히스토리에 추가
          this.addToHistory(result);
        }
      } else {
        // Interim 결과
        processedResults.interim.push(result);
        this.lastInterimTranscript = result.transcript;
      }
    }

    return processedResults;
  }

  /**
   * 히스토리에 추가
   */
  addToHistory(result) {
    this.transcriptHistory.push({
      transcript: result.transcript,
      confidence: result.confidence,
      timestamp: result.timestamp
    });

    // 히스토리 크기 제한
    if (this.transcriptHistory.length > this.maxHistorySize) {
      this.transcriptHistory.shift();
    }
  }

  /**
   * 히스토리 가져오기
   */
  getHistory(limit = 10) {
    return this.transcriptHistory.slice(-limit);
  }

  /**
   * 히스토리 초기화
   */
  clearHistory() {
    this.transcriptHistory = [];
    this.lastFinalTranscript = '';
    this.lastInterimTranscript = '';
  }

  /**
   * 마지막 최종 텍스트
   */
  getLastFinal() {
    return this.lastFinalTranscript;
  }

  /**
   * 마지막 중간 텍스트
   */
  getLastInterim() {
    return this.lastInterimTranscript;
  }
}

/**
 * Translation Engine Utility
 * 다중 번역 엔진 지원 (Google, Papago, DeepL)
 */

export const TRANSLATION_ENGINES = {
  GOOGLE: 'google',
  PAPAGO: 'papago',
  DEEPL: 'deepl'
};

/**
 * 번역 캐시 (메모리)
 */
class TranslationCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    // LRU: 캐시가 가득 차면 가장 오래된 항목 제거
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

/**
 * Google Translate (Public API - 비공식)
 * 무료, 별도 API 키 불필요
 */
async function translateWithGoogle(text, sourceLang, targetLang) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const data = await response.json();

    // 응답 파싱: data[0]은 번역 결과 배열
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

/**
 * Google Apps Script API (Script로 프록시)
 * API 키 필요, 더 안정적
 */
async function translateWithGoogleScript(text, sourceLang, targetLang, apiKey) {
  try {
    const url = apiKey; // apiKey는 실제로 Apps Script 배포 URL

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        source: sourceLang,
        target: targetLang
      })
    });

    if (!response.ok) {
      throw new Error(`Google Script API error: ${response.status}`);
    }

    const data = await response.json();
    return data.translatedText || data.text;
  } catch (error) {
    console.error('Google Script API error:', error);
    throw error;
  }
}

/**
 * Papago API (네이버)
 * API 키 필요, 한국어 최적화
 */
async function translateWithPapago(text, sourceLang, targetLang, apiKey, apiSecret) {
  try {
    // Papago 언어 코드 매핑
    const langMap = {
      'auto': 'auto',
      'ko': 'ko',
      'en': 'en',
      'ja': 'ja',
      'zh-CN': 'zh-CN',
      'zh-TW': 'zh-TW',
      'es': 'es',
      'fr': 'fr',
      'vi': 'vi',
      'th': 'th',
      'id': 'id'
    };

    const source = langMap[sourceLang] || sourceLang;
    const target = langMap[targetLang] || targetLang;

    // CORS 이슈로 인해 Apps Script나 백엔드 프록시 필요
    // 여기서는 Chrome Extension의 경우를 위한 구조만 제시

    const response = await fetch('https://naveropenapi.apigw.ntruss.com/nmt/v1/translation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-NCP-APIGW-API-KEY-ID': apiKey,
        'X-NCP-APIGW-API-KEY': apiSecret
      },
      body: `source=${source}&target=${target}&text=${encodeURIComponent(text)}`
    });

    if (!response.ok) {
      throw new Error(`Papago API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message.result.translatedText;
  } catch (error) {
    console.error('Papago API error:', error);
    throw error;
  }
}

/**
 * DeepL API
 * API 키 필요, 고품질 번역
 */
async function translateWithDeepL(text, sourceLang, targetLang, apiKey) {
  try {
    // DeepL 언어 코드 매핑
    const langMap = {
      'auto': '',
      'en': 'EN',
      'ko': 'KO',
      'ja': 'JA',
      'zh': 'ZH',
      'de': 'DE',
      'fr': 'FR',
      'es': 'ES',
      'it': 'IT',
      'pt': 'PT',
      'ru': 'RU'
    };

    const source = langMap[sourceLang] || sourceLang.toUpperCase();
    const target = langMap[targetLang] || targetLang.toUpperCase();

    const url = apiKey.includes('free')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const params = new URLSearchParams({
      auth_key: apiKey,
      text: text,
      target_lang: target
    });

    if (source && source !== '') {
      params.append('source_lang', source);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.status}`);
    }

    const data = await response.json();
    return data.translations[0].text;
  } catch (error) {
    console.error('DeepL API error:', error);
    throw error;
  }
}

/**
 * 통합 번역 함수
 */
export async function translate(text, sourceLang = 'auto', targetLang = 'ko', options = {}) {
  if (!text || text.trim() === '') {
    return '';
  }

  // 캐시 키 생성
  const cacheKey = `${text}|${sourceLang}|${targetLang}|${options.engine || 'google'}`;

  // 캐시 확인
  if (translationCache.has(cacheKey)) {
    console.log('Translation cache hit:', text.substring(0, 30));
    return translationCache.get(cacheKey);
  }

  const engine = options.engine || TRANSLATION_ENGINES.GOOGLE;
  const apiKey = options.apiKey;
  const apiSecret = options.apiSecret;

  let translatedText = '';

  try {
    switch (engine) {
      case TRANSLATION_ENGINES.GOOGLE:
        if (apiKey && apiKey.includes('script.google.com')) {
          // Google Apps Script API
          translatedText = await translateWithGoogleScript(text, sourceLang, targetLang, apiKey);
        } else {
          // Google Public API (기본)
          translatedText = await translateWithGoogle(text, sourceLang, targetLang);
        }
        break;

      case TRANSLATION_ENGINES.PAPAGO:
        if (!apiKey || !apiSecret) {
          throw new Error('Papago API requires apiKey and apiSecret');
        }
        translatedText = await translateWithPapago(text, sourceLang, targetLang, apiKey, apiSecret);
        break;

      case TRANSLATION_ENGINES.DEEPL:
        if (!apiKey) {
          throw new Error('DeepL API requires apiKey');
        }
        translatedText = await translateWithDeepL(text, sourceLang, targetLang, apiKey);
        break;

      default:
        throw new Error(`Unknown translation engine: ${engine}`);
    }

    // 캐시 저장
    translationCache.set(cacheKey, translatedText);

    console.log(`Translated [${engine}]:`, text.substring(0, 30), '->', translatedText.substring(0, 30));

    return translatedText;
  } catch (error) {
    console.error(`Translation failed with ${engine}:`, error);

    // Fallback: 다른 엔진으로 재시도
    if (engine !== TRANSLATION_ENGINES.GOOGLE) {
      console.log('Falling back to Google Translate...');
      return translate(text, sourceLang, targetLang, { engine: TRANSLATION_ENGINES.GOOGLE });
    }

    throw error;
  }
}

/**
 * 배치 번역 (여러 문장을 한 번에)
 */
export async function translateBatch(texts, sourceLang = 'auto', targetLang = 'ko', options = {}) {
  const results = await Promise.all(
    texts.map(text => translate(text, sourceLang, targetLang, options))
  );
  return results;
}

/**
 * 캐시 관리
 */
export function clearCache() {
  translationCache.clear();
  console.log('Translation cache cleared');
}

export function getCacheSize() {
  return translationCache.getSize();
}

/**
 * API 사용량 추적 (간단한 버전)
 */
class UsageTracker {
  constructor() {
    this.usage = {};
  }

  async loadUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['translationUsage'], (result) => {
        this.usage = result.translationUsage || {};
        resolve(this.usage);
      });
    });
  }

  async saveUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ translationUsage: this.usage }, resolve);
    });
  }

  track(engine, charCount) {
    const today = new Date().toISOString().split('T')[0];

    if (!this.usage[engine]) {
      this.usage[engine] = {};
    }

    if (!this.usage[engine][today]) {
      this.usage[engine][today] = 0;
    }

    this.usage[engine][today] += charCount;
    this.saveUsage();
  }

  getUsage(engine, date = null) {
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }
    return this.usage[engine]?.[date] || 0;
  }
}

export const usageTracker = new UsageTracker();

// 초기화
usageTracker.loadUsage();

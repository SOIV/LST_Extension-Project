/**
 * LST - Background Service Worker (커뮤니티 자막)
 * Chrome Extension Manifest V3
 *
 * 역할:
 * - 탭별 자막 상태 관리 (content script → background)
 * - 배지 업데이트 (자막 있음/없음/로딩)
 * - 기본 설정 초기화
 */

// ─── 상태 관리 ────────────────────────────────────────────────────────────────

/** 탭별 자막 상태: 'loading' | 'available' | 'unavailable' | 'not_youtube' */
const tabSubtitleStatus = new Map();
let sttState = { active: false, tabId: null, source: null };

const SENSITIVE_SETTING_KEYS = [
  'openaiApiKey',
  'googleScriptUrl',
  'papagoApiKey',
  'papagoApiSecret',
  'deeplApiKey',
];

const LEGACY_SENSITIVE_SETTING_KEYS = [
  'interimGoogleScriptUrl',
  'interimPapagoApiKey',
  'interimPapagoApiSecret',
  'interimDeeplApiKey',
];

const SENSITIVE_SYNC_CLEANUP_KEYS = [
  ...SENSITIVE_SETTING_KEYS,
  ...LEGACY_SENSITIVE_SETTING_KEYS,
];

const LANG_ISO = {
  'ko': 'ko', 'en': 'en', 'ja': 'ja',
  'zh-CN': 'zh', 'zh-TW': 'zh',
  'es': 'es', 'fr': 'fr', 'de': 'de', 'ru': 'ru',
};

// ─── 배지 ─────────────────────────────────────────────────────────────────────

const BADGE = {
  available:   { text: 'CC',  color: '#22c55e' }, // 초록
  unavailable: { text: '',    color: '#71717a' }, // 없음
  loading:     { text: '…',   color: '#a1a1aa' }, // 회색
  not_youtube: { text: '',    color: '#71717a' }, // 없음
  stt_active:  { text: 'STT', color: '#ef4444' }, // 빨간색 (STT 녹음 중)
};

function updateBadge(tabId, status) {
  if (!tabId) return;
  const b = BADGE[status] ?? BADGE.unavailable;
  chrome.action.setBadgeText({ tabId, text: b.text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: b.color }).catch(() => {});
}

// ─── 메시지 수신 (content script → background) ────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (message.action === 'subtitleStatus' && tabId) {
    tabSubtitleStatus.set(tabId, message.status);
    updateBadge(tabId, message.status);
    return;
  }

  // 플레이어 패널 ⚙ 설정 버튼 → 팝업 열기
  if (message.action === 'openPopup') {
    chrome.action.openPopup().catch(() => {});
    return;
  }

  // 탭 오디오 캡처 시작 (팝업 → 백그라운드)
  if (message.action === 'startTabCapture') {
    const targetTabId = message.tabId;
    if (!targetTabId) { sendResponse({ success: false, error: 'No tabId' }); return; }
    startTabCapture(targetTabId)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // 탭 오디오 캡처 중지
  if (message.action === 'stopTabCapture') {
    stopTabCapture()
      .then(() => sendResponse({ success: true }));
    return true;
  }

  // content script 오버레이 닫기 → 현재 탭 STT 전체 중지
  if (message.action === 'stopSttForCurrentTab' && tabId) {
    stopSttForTab(tabId)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.action === 'translateText') {
    translateForContentScript(message)
      .then(translated => sendResponse({ success: true, translated }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // Whisper 전사 결과 → content script 전달 (offscreen → background → tab)
  if (message.action === 'whisperTranscript') {
    const targetTabId = tabCaptureActiveTabId;
    if (targetTabId !== null && sttState.active && sttState.tabId === targetTabId) {
      chrome.tabs.sendMessage(targetTabId, {
        action:     'whisperTranscript',
        text:       message.text,
        translated: message.translated,
        interim:    message.interim,
      }).catch(() => {});
    }
    sendResponse({ success: true });
    return;
  }

  // offscreen 쪽 캡처/Realtime 연결이 먼저 종료된 경우 → background 상태 동기화
  if (message.action === 'tabCaptureStopped') {
    handleTabCaptureStopped(message.reason)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // STT 활성 상태 → 배지 업데이트
  if (message.action === 'sttStateChange') {
    const { active, tabId: sttTabId, source } = message;
    if (sttTabId) {
      if (active) {
        if (sttState.active && sttState.tabId !== sttTabId) {
          const prevTabId = sttState.tabId;
          chrome.tabs.sendMessage(prevTabId, { action: 'stopCapture' }).catch(() => {});
          if (tabCaptureActiveTabId === prevTabId) {
            stopTabCapture().catch(() => {});
          }
          updateBadge(prevTabId, tabSubtitleStatus.get(prevTabId) || 'not_youtube');
        }
        sttState = { active: true, tabId: sttTabId, source: source || null };
        updateBadge(sttTabId, 'stt_active');
      } else {
        if (sttState.tabId === sttTabId) {
          sttState = { active: false, tabId: null, source: null };
        }
        const prevStatus = tabSubtitleStatus.get(sttTabId) || 'not_youtube';
        updateBadge(sttTabId, prevStatus);
      }
    }
    sendResponse({ success: true });
    return;
  }

  if (message.action === 'getSttState') {
    sendResponse({ success: true, ...sttState });
    return;
  }
});

// ─── 탭 오디오 캡처 ───────────────────────────────────────────────────────────

let tabCaptureActiveTabId = null;

async function getStoredSettings(keys = null) {
  const syncSettings = await chrome.storage.sync.get(keys);
  const localSettings = await chrome.storage.local.get(SENSITIVE_SETTING_KEYS);
  return { ...syncSettings, ...localSettings };
}

async function hasOffscreenDocument() {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    return contexts.length > 0;
  } catch {
    return false;
  }
}

async function startTabCapture(tabId) {
  if (tabCaptureActiveTabId !== null || (sttState.active && sttState.source === 'tab')) {
    await stopTabCapture();
  }

  const settings = await getStoredSettings([
    'openaiApiKey', 'sourceLang', 'targetLang', 'sttEngine',
    'translationEngine', 'googleScriptUrl', 'papagoApiKey', 'papagoApiSecret', 'deeplApiKey',
    'interimTranslationEnabled', 'interimTranslationEngine',
    'sttSilenceMs', 'sttMinDisplayMs', 'whisperModel', 'realtimeModel',
  ]);

  if (!settings.openaiApiKey) {
    throw new Error('OpenAI API key is required for tab audio STT');
  }

  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['USER_MEDIA', 'WEB_RTC'],
      justification: '탭 오디오 캡처 및 WebRTC STT 처리',
    });
  }

  const response = await chrome.runtime.sendMessage({ action: 'tabCaptureStream', streamId, settings });
  if (!response?.success) {
    if (await hasOffscreenDocument()) {
      chrome.offscreen.closeDocument().catch(() => {});
    }
    throw new Error(response?.error || 'Failed to start tab audio capture');
  }

  tabCaptureActiveTabId = tabId;
  sttState = { active: true, tabId, source: 'tab' };
  updateBadge(tabId, 'stt_active');

  chrome.tabs.sendMessage(tabId, { action: 'tabCaptureActive' }).catch(() => {});
}

async function stopTabCapture() {
  const stoppedTabId = tabCaptureActiveTabId ?? (sttState.source === 'tab' ? sttState.tabId : null);
  tabCaptureActiveTabId = null;

  chrome.runtime.sendMessage({ action: 'tabCaptureStop' }).catch(() => {});

  if (stoppedTabId !== null) {
    chrome.tabs.sendMessage(stoppedTabId, { action: 'tabCaptureInactive' }).catch(() => {});
    if (sttState.tabId === stoppedTabId) {
      sttState = { active: false, tabId: null, source: null };
    }
    updateBadge(stoppedTabId, tabSubtitleStatus.get(stoppedTabId) || 'not_youtube');
  }

  if (await hasOffscreenDocument()) {
    chrome.offscreen.closeDocument().catch(() => {});
  }
}

async function handleTabCaptureStopped(reason = 'unknown') {
  const stoppedTabId = tabCaptureActiveTabId ?? (sttState.source === 'tab' ? sttState.tabId : null);
  tabCaptureActiveTabId = null;

  if (stoppedTabId !== null) {
    chrome.tabs.sendMessage(stoppedTabId, { action: 'tabCaptureInactive' }).catch(() => {});
    if (sttState.tabId === stoppedTabId) {
      sttState = { active: false, tabId: null, source: null };
    }
    updateBadge(stoppedTabId, tabSubtitleStatus.get(stoppedTabId) || 'not_youtube');
  } else if (sttState.source === 'tab') {
    // tabCaptureActiveTabId가 이미 초기화됐어도 탭에 비활성 알림은 보내야 한다
    const orphanedTabId = sttState.tabId;
    sttState = { active: false, tabId: null, source: null };
    if (orphanedTabId) {
      chrome.tabs.sendMessage(orphanedTabId, { action: 'tabCaptureInactive' }).catch(() => {});
      updateBadge(orphanedTabId, tabSubtitleStatus.get(orphanedTabId) || 'not_youtube');
    }
  }

  if (await hasOffscreenDocument()) {
    chrome.offscreen.closeDocument().catch(() => {});
  }

  console.warn('[LST Background] Tab audio capture stopped:', reason);
}

async function stopSttForTab(tabId) {
  chrome.tabs.sendMessage(tabId, { action: 'stopCapture' }).catch(() => {});

  if (tabCaptureActiveTabId === tabId) {
    await stopTabCapture();
  }

  if (sttState.tabId === tabId) {
    sttState = { active: false, tabId: null, source: null };
    updateBadge(tabId, tabSubtitleStatus.get(tabId) || 'not_youtube');
  }
}

// ─── 번역 프록시 (content script CORS 회피) ───────────────────────────────────

async function translateForContentScript(message) {
  const text = message.text || '';
  if (!text.trim()) return text;

  const settings = await getStoredSettings([
    'translationEngine', 'interimTranslationEngine',
    'googleScriptUrl', 'papagoApiKey', 'papagoApiSecret', 'deeplApiKey',
  ]);
  return translateText(text, message.sourceLang || 'auto', message.targetLang || 'ko', message.opts || {}, settings);
}

async function translateText(text, sourceLang, targetLang, opts = {}, settings = {}) {
  if (!targetLang || targetLang === sourceLang) return text;

  const sl = sourceLang === 'auto' ? 'auto' : (LANG_ISO[sourceLang] || sourceLang);
  const tl = LANG_ISO[targetLang] || targetLang;
  const scope = opts.scope === 'interim' ? 'interim' : 'main';
  const engine = opts.engine || (scope === 'interim'
    ? settings.interimTranslationEngine
    : settings.translationEngine) || 'google';

  const credentials = getTranslationCredentials(engine, scope, settings);

  try {
    switch (engine) {
      case 'google_script':
        if (credentials.googleScriptUrl) {
          return await translateWithScript(text, sl, tl, credentials.googleScriptUrl);
        }
        break;
      case 'papago':
        if (credentials.papagoApiKey && credentials.papagoApiSecret) {
          return await translateWithPapago(text, sl, tl, credentials.papagoApiKey, credentials.papagoApiSecret);
        }
        break;
      case 'deepl':
        if (credentials.deeplApiKey) {
          return await translateWithDeepL(text, sl, tl, credentials.deeplApiKey);
        }
        break;
    }
  } catch (err) {
    console.debug('[LST Background] Translation fallback to Google:', err.message);
  }

  return translateWithGoogle(text, sl, tl);
}

function getTranslationCredentials(engine, scope, settings) {
  void engine;
  void scope;
  return {
    googleScriptUrl: settings.googleScriptUrl || '',
    papagoApiKey:    settings.papagoApiKey || '',
    papagoApiSecret: settings.papagoApiSecret || '',
    deeplApiKey:     settings.deeplApiKey || '',
  };
}

async function translateWithGoogle(text, sl, tl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    return data[0]?.map(i => i[0]).filter(Boolean).join('') || text;
  } catch {
    return text;
  }
}

async function translateWithScript(text, sl, tl, scriptUrl) {
  const url = normalizeAppsScriptUrl(scriptUrl);
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text, source: sl, target: tl }),
  });
  if (!res.ok) throw new Error(`Script API ${res.status}`);
  const data = await res.json();
  return data.translatedText || data.text || text;
}

function normalizeAppsScriptUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const deploymentId = raw
    .replace(/^\/+|\/+$/g, '')
    .replace(/^macros\/s\//i, '')
    .replace(/\/(exec|dev)$/i, '');

  return `https://script.google.com/macros/s/${encodeURIComponent(deploymentId)}/exec`;
}

async function translateWithPapago(text, sl, tl, apiKey, apiSecret) {
  const res = await fetch('https://naveropenapi.apigw.ntruss.com/nmt/v1/translation', {
    method:  'POST',
    headers: {
      'Content-Type':           'application/x-www-form-urlencoded; charset=UTF-8',
      'X-NCP-APIGW-API-KEY-ID': apiKey,
      'X-NCP-APIGW-API-KEY':    apiSecret,
    },
    body: `source=${sl}&target=${tl}&text=${encodeURIComponent(text)}`,
  });
  if (!res.ok) throw new Error(`Papago API ${res.status}`);
  const data = await res.json();
  return data.message.result.translatedText;
}

async function translateWithDeepL(text, sl, tl, apiKey) {
  const DEEPL_LANG = {
    'ko': 'KO', 'en': 'EN', 'ja': 'JA', 'zh': 'ZH',
    'de': 'DE', 'fr': 'FR', 'es': 'ES', 'ru': 'RU',
  };
  const targetCode = DEEPL_LANG[tl] || tl.toUpperCase();
  const sourceCode = (sl && sl !== 'auto') ? (DEEPL_LANG[sl] || sl.toUpperCase()) : '';
  const url = apiKey.includes(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
  const params = new URLSearchParams({ auth_key: apiKey, text, target_lang: targetCode });
  if (sourceCode) params.append('source_lang', sourceCode);
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params,
  });
  if (!res.ok) throw new Error(`DeepL API ${res.status}`);
  const data = await res.json();
  return data.translations[0].text;
}

// ─── 탭 정리 ──────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  tabSubtitleStatus.delete(tabId);
  if (tabCaptureActiveTabId === tabId) {
    stopTabCapture().catch(() => {});
  }
  if (sttState.tabId === tabId) {
    sttState = { active: false, tabId: null, source: null };
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 페이지 이동 시 배지 초기화
  if (changeInfo.status === 'loading') {
    if (sttState.tabId === tabId || tabCaptureActiveTabId === tabId) {
      stopSttForTab(tabId).catch(() => {});
    }

    const url = tab?.url || tab?.pendingUrl || '';
    const isYouTube =
      /^https:\/\/(www\.)?youtube\.com\//.test(url);

    if (isYouTube) {
      updateBadge(tabId, 'loading');
    } else {
      tabSubtitleStatus.set(tabId, 'not_youtube');
      updateBadge(tabId, 'not_youtube');
    }
  }
});

// ─── 서비스 워커 시작 시 고아 offscreen 정리 ──────────────────────────────────
// MV3 서비스 워커는 절전 후 재시작 시 sttState 등 메모리 상태가 초기화되는데,
// offscreen 문서는 살아있어 상태 불일치가 발생할 수 있다. 시작 시 정리한다.
(async () => {
  try {
    if (await hasOffscreenDocument()) {
      await chrome.offscreen.closeDocument();
      console.warn('[LST Background] Orphaned offscreen document cleaned up on startup');
    }
  } catch (e) {
    console.debug('[LST Background] Startup cleanup:', e.message);
  }
})();

// ─── 설치 / 업데이트 ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  // 없는 키만 기본값으로 채워줌 (기존 사용자 설정 보존)
  const existing = await chrome.storage.sync.get(null);
  const existingLocal = await chrome.storage.local.get(SENSITIVE_SETTING_KEYS);
  const defaults = {
    subtitleEnabled:  true,
    subtitleLang:     'auto',
    enableCache:      true,
    // 표시 - 공통 (YouTube 1:1)
    fontFamily:       'proportional-sans-serif',
    fontColor:        'white',
    fontOpacity:      '100',
    overlaySize:      '100',
    edgeStyle:        'drop-shadow',
    bgColor:          'black',
    bgOpacity:        '75',
    windowColor:      'black',
    windowOpacity:    '0',
    // 표시 - 실시간
    overlayDisplayMode: 'split',
    overlayPosition:  'bottom',
    textAlign:        'center',
    // 번역 - 메인
    translationEngine:   'google',
    // 번역 - 중간
    interimTranslationEnabled: false,
    interimTranslationEngine:  'same',
    // STT
    sttSource:         'tab',
    sttEngine:         'whisper',
    sourceLang:        'auto',
    targetLang:        'ko',
    sttSilenceMs:      1500,
    sttMinDisplayMs:   4000,
    whisperModel:      'gpt-4o-mini-transcribe',
    realtimeModel:     'gpt-realtime-whisper',
  };
  const missing = {};
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in existing)) missing[k] = v;
  }
  if (Object.keys(missing).length > 0) {
    await chrome.storage.sync.set(missing);
  }
  const migratedSensitive = {};
  for (const key of SENSITIVE_SETTING_KEYS) {
    if (existing[key] && !existingLocal[key]) {
      migratedSensitive[key] = existing[key];
    }
  }
  if (Object.keys(migratedSensitive).length > 0) {
    await chrome.storage.local.set(migratedSensitive);
  }
  await chrome.storage.sync.remove(SENSITIVE_SYNC_CLEANUP_KEYS);
  console.log('[LST] onInstalled — settings checked');
});

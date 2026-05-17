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

// ─── 배지 ─────────────────────────────────────────────────────────────────────

const BADGE = {
  available:   { text: 'CC',  color: '#22c55e' }, // 초록
  unavailable: { text: '',    color: '#71717a' }, // 없음
  loading:     { text: '…',   color: '#a1a1aa' }, // 회색
  not_youtube: { text: '',    color: '#71717a' }, // 없음
  stt_active:  { text: 'STT', color: '#ef4444' }, // 빨간색 (STT 녹음 중)
};

function updateBadge(tabId, status) {
  const b = BADGE[status] ?? BADGE.unavailable;
  chrome.action.setBadgeText({ tabId, text: b.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
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

  // Whisper 전사 결과 → content script 전달 (offscreen → background → tab)
  if (message.action === 'whisperTranscript') {
    if (tabCaptureActiveTabId !== null) {
      chrome.tabs.sendMessage(tabCaptureActiveTabId, {
        action:     'whisperTranscript',
        text:       message.text,
        translated: message.translated,
        interim:    message.interim,
      }).catch(() => {});
    }
    sendResponse({ success: true });
    return;
  }

  // STT 활성 상태 → 배지 업데이트
  if (message.action === 'sttStateChange') {
    const { active, tabId: sttTabId } = message;
    if (sttTabId) {
      if (active) {
        updateBadge(sttTabId, 'stt_active');
      } else {
        const prevStatus = tabSubtitleStatus.get(sttTabId) || 'not_youtube';
        updateBadge(sttTabId, prevStatus);
      }
    }
    sendResponse({ success: true });
    return;
  }
});

// ─── 탭 오디오 캡처 ───────────────────────────────────────────────────────────

let tabCaptureActiveTabId = null;

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
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Tab audio capture for realtime STT',
    });
  }

  const settings = await chrome.storage.sync.get([
    'openaiApiKey', 'sourceLang', 'targetLang', 'sttEngine',
    'translationEngine', 'googleScriptUrl', 'papagoApiKey', 'papagoApiSecret', 'deeplApiKey',
    'interimTranslationEnabled', 'interimTranslationEngine',
    'interimGoogleScriptUrl', 'interimPapagoApiKey', 'interimPapagoApiSecret', 'interimDeeplApiKey',
    'sttSilenceMs', 'sttMinDisplayMs', 'whisperModel', 'realtimeModel',
  ]);

  await chrome.runtime.sendMessage({ action: 'tabCaptureStream', streamId, settings });
  tabCaptureActiveTabId = tabId;

  chrome.tabs.sendMessage(tabId, { action: 'tabCaptureActive' }).catch(() => {});
}

async function stopTabCapture() {
  chrome.runtime.sendMessage({ action: 'tabCaptureStop' }).catch(() => {});

  if (await hasOffscreenDocument()) {
    chrome.offscreen.closeDocument().catch(() => {});
  }

  if (tabCaptureActiveTabId !== null) {
    chrome.tabs.sendMessage(tabCaptureActiveTabId, { action: 'tabCaptureInactive' }).catch(() => {});
    tabCaptureActiveTabId = null;
  }
}

// ─── 탭 정리 ──────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  tabSubtitleStatus.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 페이지 이동 시 배지 초기화
  if (changeInfo.status === 'loading') {
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

// ─── 설치 / 업데이트 ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  // 없는 키만 기본값으로 채워줌 (기존 사용자 설정 보존)
  const existing = await chrome.storage.sync.get(null);
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
    overlayPosition:  'bottom',
    // 번역 - 메인
    translationEngine:   'google',
    googleScriptUrl:     '',
    papagoApiKey:        '',
    papagoApiSecret:     '',
    deeplApiKey:         '',
    // 번역 - 중간
    interimTranslationEnabled: false,
    interimTranslationEngine:  'same',
    interimGoogleScriptUrl:    '',
    interimPapagoApiKey:       '',
    interimPapagoApiSecret:    '',
    interimDeeplApiKey:        '',
    // STT
    sttSource:         'tab',
    sttEngine:         'whisper',
    sourceLang:        'auto',
    targetLang:        'ko',
    openaiApiKey:      '',
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
  console.log('[LST] onInstalled — settings checked');
});

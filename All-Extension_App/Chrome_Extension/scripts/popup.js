/**
 * Live Stream Translator - Popup Script
 */

// 잠금 탭 목록 (Phase 6에서 해제)
const LOCKED_TABS = ['language', 'translation', 'status'];

// 디버그 모드 상태
let debugMode = false;
let logoClickCount = 0;
let logoClickTimer = null;

/**
 * i18n 메시지 가져오기
 */
function getMessage(key, fallback = '') {
  return chrome.i18n.getMessage(key) || fallback;
}

/**
 * data-i18n 속성으로 텍스트 일괄 적용
 */
function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const msg = getMessage(key);
    if (msg) el.textContent = msg;
  });

  // 슬라이더 레이블은 텍스트로만 처리 (innerHTML 방식 유지)
  const sizeLabel = document.querySelector('label[for="overlaySize"]');
  if (sizeLabel) {
    sizeLabel.childNodes[0].textContent = getMessage('label_overlaySize', '글꼴 크기') + ': ';
  }
}

// DOM 요소
const elements = {
  // 커뮤니티 자막 탭
  subtitleEnabled: document.getElementById('subtitleEnabled'),
  subtitleLang: document.getElementById('subtitleLang'),
  subtitleStatusCard: document.getElementById('subtitleStatusCard'),
  subtitleStatusIcon: document.getElementById('subtitleStatusIcon'),
  subtitleStatusText: document.getElementById('subtitleStatusText'),
  subtitleStatusSub: document.getElementById('subtitleStatusSub'),

  // 표시 탭 - 공통
  fontFamily:         document.getElementById('fontFamily'),
  fontColor:          document.getElementById('fontColor'),
  fontOpacity:        document.getElementById('fontOpacity'),
  fontOpacityValue:   document.getElementById('fontOpacityValue'),
  overlaySize:        document.getElementById('overlaySize'),
  sizeValue:          document.getElementById('sizeValue'),
  edgeStyle:          document.getElementById('edgeStyle'),
  bgColor:            document.getElementById('bgColor'),
  bgOpacity:          document.getElementById('bgOpacity'),
  bgOpacityValue:     document.getElementById('bgOpacityValue'),
  windowColor:        document.getElementById('windowColor'),
  windowOpacity:      document.getElementById('windowOpacity'),
  windowOpacityValue: document.getElementById('windowOpacityValue'),
  resetDisplayBtn:    document.getElementById('resetDisplayBtn'),

  // 실시간 탭 - STT
  sttBtn:         document.getElementById('sttBtn'),
  sttSource:      document.getElementById('sttSource'),
  sttEngine:      document.getElementById('sttEngine'),
  openaiApiKey:   document.getElementById('openaiApiKey'),
  openaiKeyGroup: document.getElementById('openaiKeyGroup'),

  // 실시간 탭 - 번역
  translationEngine: document.getElementById('translationEngine'),
  googleScriptUrl:   document.getElementById('googleScriptUrl'),
  papagoApiKey:      document.getElementById('papagoApiKey'),
  papagoApiSecret:   document.getElementById('papagoApiSecret'),
  deeplApiKey:       document.getElementById('deeplApiKey'),

  // 표시 탭 - 실시간
  showOriginal:    document.getElementById('showOriginal'),
  overlayPosition: document.getElementById('overlayPosition'),
  enableCache:     document.getElementById('enableCache'),

  // 공통
  navItems: document.querySelectorAll('.nav-item:not(.locked)'),
  tabContents: document.querySelectorAll('.tab-content'),
  pageTitle: document.getElementById('pageTitle'),
};

// 탭 제목 i18n 키 맵
const TAB_TITLE_KEYS = {
  community: 'title_community',
  realtime: 'title_realtime',
  display: 'title_display',
  about: 'title_about',
};

// 글꼴 크기 슬라이더 매핑 (YouTube 1:1)
const SIZE_MAP = ['50', '75', '100', '150', '200', '300', '400'];

// 불투명도 슬라이더 매핑
const OPACITY_MAP = ['0', '25', '50', '75', '100'];

function sliderToPercent(index) {
  return SIZE_MAP[index] || '100';
}

function percentToSlider(percent) {
  const index = SIZE_MAP.indexOf(String(percent));
  return index !== -1 ? index : 2;
}

function sliderToOpacity(index) {
  return OPACITY_MAP[Number(index)] || '100';
}

function opacityToSlider(percent) {
  const index = OPACITY_MAP.indexOf(String(percent));
  return index !== -1 ? index : 4; // 기본값 100%
}

/**
 * 메인 탭 전환
 */
function switchTab(tabName) {
  elements.tabContents.forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  const selectedTab = document.getElementById(`tab-${tabName}`);
  if (selectedTab) selectedTab.classList.add('active');

  const selectedNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (selectedNav) selectedNav.classList.add('active');

  const titleKey = TAB_TITLE_KEYS[tabName];
  elements.pageTitle.textContent = titleKey ? getMessage(titleKey, tabName) : tabName;

  // STT 토글: 실시간 탭에서만 표시
  const headerSttToggle = document.getElementById('headerSttToggle');
  if (headerSttToggle) {
    headerSttToggle.style.display = tabName === 'realtime' ? 'flex' : 'none';
  }
}

/**
 * 내부 탭 전환
 */
function switchInnerTab(tabEl) {
  const innerName = tabEl.getAttribute('data-inner');
  const parentTab = tabEl.closest('.tab-content');
  if (!parentTab) return;

  // 같은 탭 내부에서만 전환
  parentTab.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
  parentTab.querySelectorAll('.inner-content').forEach(c => c.classList.remove('active'));

  tabEl.classList.add('active');
  const content = document.getElementById(`inner-${innerName}`);
  if (content) content.classList.add('active');
}

let sttListening = false;

function setSttState(listening) {
  sttListening = listening;
  chrome.storage.local.set({ sttListening: listening });
  if (!elements.sttBtn) return;
  if (listening) {
    elements.sttBtn.textContent = 'STOP LISTENING';
    elements.sttBtn.classList.replace('btn-stt-start', 'btn-stt-stop');
  } else {
    elements.sttBtn.textContent = 'START LISTENING';
    elements.sttBtn.classList.replace('btn-stt-stop', 'btn-stt-start');
  }
}

let autoSaveTimer = null;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveSettings(true), 500);
}

/** 기본 표시 설정값 (YouTube 1:1) */
const DISPLAY_DEFAULTS = {
  fontFamily:    'proportional-sans-serif',
  fontColor:     'white',
  fontOpacity:   '100',
  overlaySize:   '100',
  edgeStyle:     'drop-shadow',
  bgColor:       'black',
  bgOpacity:     '75',
  windowColor:   'black',
  windowOpacity: '0',
  overlayPosition: 'bottom',
};

/**
 * 설정 로드
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (settings) => {
      // 커뮤니티 자막 설정
      if (elements.subtitleEnabled) {
        elements.subtitleEnabled.checked = settings.subtitleEnabled !== false;
      }
      if (elements.subtitleLang) {
        elements.subtitleLang.value = settings.subtitleLang || 'auto';
      }

      // 표시 - 공통
      if (elements.fontFamily)  elements.fontFamily.value  = settings.fontFamily || DISPLAY_DEFAULTS.fontFamily;
      if (elements.fontColor)   elements.fontColor.value   = settings.fontColor  || DISPLAY_DEFAULTS.fontColor;
      if (elements.edgeStyle)   elements.edgeStyle.value   = settings.edgeStyle  || DISPLAY_DEFAULTS.edgeStyle;
      if (elements.bgColor)     elements.bgColor.value     = settings.bgColor    || DISPLAY_DEFAULTS.bgColor;
      if (elements.windowColor) elements.windowColor.value = settings.windowColor|| DISPLAY_DEFAULTS.windowColor;

      // 불투명도 슬라이더
      if (elements.fontOpacity) {
        const idx = opacityToSlider(settings.fontOpacity ?? DISPLAY_DEFAULTS.fontOpacity);
        elements.fontOpacity.value = idx;
        if (elements.fontOpacityValue) elements.fontOpacityValue.textContent = OPACITY_MAP[idx] + '%';
      }
      if (elements.bgOpacity) {
        const idx = opacityToSlider(settings.bgOpacity ?? DISPLAY_DEFAULTS.bgOpacity);
        elements.bgOpacity.value = idx;
        if (elements.bgOpacityValue) elements.bgOpacityValue.textContent = OPACITY_MAP[idx] + '%';
      }
      if (elements.windowOpacity) {
        const idx = opacityToSlider(settings.windowOpacity ?? DISPLAY_DEFAULTS.windowOpacity);
        elements.windowOpacity.value = idx;
        if (elements.windowOpacityValue) elements.windowOpacityValue.textContent = OPACITY_MAP[idx] + '%';
      }

      if (elements.overlaySize) {
        const sizePercent = settings.overlaySize || DISPLAY_DEFAULTS.overlaySize;
        elements.overlaySize.value = percentToSlider(sizePercent);
        if (elements.sizeValue) elements.sizeValue.textContent = sizePercent + '%';
      }

      // 표시 - 실시간
      if (elements.showOriginal)    elements.showOriginal.checked    = settings.showOriginal    !== false;
      if (elements.overlayPosition) elements.overlayPosition.value   = settings.overlayPosition || DISPLAY_DEFAULTS.overlayPosition;
      if (elements.enableCache)     elements.enableCache.checked     = settings.enableCache     !== false;
      if (elements.sttSource)    elements.sttSource.value    = settings.sttSource    || 'tab';
      if (elements.sttEngine)    elements.sttEngine.value    = settings.sttEngine    || 'whisper';
      if (elements.openaiApiKey) elements.openaiApiKey.value = settings.openaiApiKey || '';
      updateSttEngineState(settings.sttSource || 'tab');

      // 번역
      if (elements.translationEngine) elements.translationEngine.value = settings.translationEngine || 'google';
      if (elements.googleScriptUrl)   elements.googleScriptUrl.value   = settings.googleScriptUrl   || '';
      if (elements.papagoApiKey)      elements.papagoApiKey.value      = settings.papagoApiKey      || '';
      if (elements.papagoApiSecret)   elements.papagoApiSecret.value   = settings.papagoApiSecret   || '';
      if (elements.deeplApiKey)       elements.deeplApiKey.value       = settings.deeplApiKey       || '';
      updateTranslationKeyFields(settings.translationEngine || 'google');

      resolve(settings);
    });
  });
}

/**
 * 설정 저장
 */
async function saveSettings(silent = false) {
  const settings = {
    // 커뮤니티
    subtitleEnabled: elements.subtitleEnabled?.checked ?? true,
    subtitleLang:    elements.subtitleLang?.value || 'auto',
    // 표시 - 공통
    fontFamily:    elements.fontFamily?.value    || DISPLAY_DEFAULTS.fontFamily,
    fontColor:     elements.fontColor?.value  || DISPLAY_DEFAULTS.fontColor,
    fontOpacity:   sliderToOpacity(elements.fontOpacity?.value   ?? 4),
    overlaySize:   sliderToPercent(elements.overlaySize?.value   ?? 2),
    edgeStyle:     elements.edgeStyle?.value  || DISPLAY_DEFAULTS.edgeStyle,
    bgColor:       elements.bgColor?.value    || DISPLAY_DEFAULTS.bgColor,
    bgOpacity:     sliderToOpacity(elements.bgOpacity?.value     ?? 3),
    windowColor:   elements.windowColor?.value|| DISPLAY_DEFAULTS.windowColor,
    windowOpacity: sliderToOpacity(elements.windowOpacity?.value ?? 0),
    // 표시 - 실시간
    showOriginal:    elements.showOriginal?.checked    ?? true,
    overlayPosition: elements.overlayPosition?.value   || DISPLAY_DEFAULTS.overlayPosition,
    enableCache:     elements.enableCache?.checked     ?? true,
    // 실시간 STT
    sttSource:    elements.sttSource?.value    || 'tab',
    sttEngine:    elements.sttEngine?.value    || 'whisper',
    openaiApiKey: elements.openaiApiKey?.value || '',
    // 번역
    translationEngine: elements.translationEngine?.value || 'google',
    googleScriptUrl:   elements.googleScriptUrl?.value   || '',
    papagoApiKey:      elements.papagoApiKey?.value      || '',
    papagoApiSecret:   elements.papagoApiSecret?.value   || '',
    deeplApiKey:       elements.deeplApiKey?.value       || '',
  };

  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      // 활성 탭에 설정 변경 알림
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'updateSettings', settings })
            .catch(() => {});
        }
      });
      if (!silent) showToast(getMessage('toast_saved', '설정이 저장되었습니다.'), 'success');
      resolve(settings);
    });
  });
}

/**
 * 현재 영상 자막 상태 조회
 */
function checkSubtitleStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, { action: 'getSubtitleStatus' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setSubtitleStatus('idle');
        return;
      }
      setSubtitleStatus(response.status, response.languages);
    });
  });
}

/**
 * 자막 상태 UI 업데이트
 */
function setSubtitleStatus(status, languages = []) {
  const card = elements.subtitleStatusCard;
  const text = elements.subtitleStatusText;
  const sub = elements.subtitleStatusSub;

  card.classList.remove('available', 'unavailable');

  switch (status) {
    case 'available':
      card.classList.add('available');
      text.textContent = getMessage('subtitle_available', '자막 있음');
      sub.textContent = languages.length > 0 ? languages.join(', ') : '';
      break;
    case 'unavailable':
      card.classList.add('unavailable');
      text.textContent = getMessage('subtitle_unavailable', '자막 없음');
      sub.textContent = getMessage('subtitle_unavailable_sub', '이 영상의 커뮤니티 자막이 없습니다');
      break;
    case 'not_youtube':
      text.textContent = getMessage('subtitle_not_youtube', 'YouTube 영상이 아닙니다');
      sub.textContent = '';
      break;
    default:
      text.textContent = getMessage('subtitle_loading', '확인 중...');
      sub.textContent = '';
  }
}

/**
 * 토스트 알림
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * 디버그 모드 토글
 */
function toggleDebugMode(enabled) {
  debugMode = enabled;
  chrome.storage.local.set({ debugMode: enabled });

  const logo = document.querySelector('.logo');
  const lockedItems = document.querySelectorAll('.nav-item.locked');
  const lockedBanners = document.querySelectorAll('.locked-banner');
  const lockedContents = document.querySelectorAll('.settings-locked');

  if (enabled) {
    logo.classList.add('logo--debug');
    lockedItems.forEach(item => {
      item.classList.add('debug-unlocked');
      item.style.pointerEvents = 'auto';
      item.style.opacity = '1';
    });
    lockedBanners.forEach(b => b.style.display = 'none');
    lockedContents.forEach(c => {
      c.style.opacity = '1';
      c.style.pointerEvents = 'auto';
      c.style.userSelect = 'auto';
      c.querySelectorAll('[disabled]').forEach(el => el.removeAttribute('disabled'));
    });
    if (elements.sttBtn)       elements.sttBtn.removeAttribute('disabled');
    if (elements.sttSource)    elements.sttSource.removeAttribute('disabled');
    if (elements.openaiApiKey) elements.openaiApiKey.removeAttribute('disabled');
    // sttEngine은 sttSource 값 기준으로 활성 여부 결정
    updateSttEngineState(elements.sttSource?.value || 'tab');
    showToast('🔧 디버그 모드 활성화', 'info');
  } else {
    logo.classList.remove('logo--debug');
    lockedItems.forEach(item => {
      item.classList.remove('debug-unlocked');
      item.style.pointerEvents = '';
      item.style.opacity = '';
    });
    lockedBanners.forEach(b => b.style.display = '');
    lockedContents.forEach(c => {
      c.style.opacity = '';
      c.style.pointerEvents = '';
      c.style.userSelect = '';
      c.querySelectorAll('select, input, button').forEach(el => el.setAttribute('disabled', ''));
    });
    if (elements.sttBtn)       elements.sttBtn.setAttribute('disabled', '');
    if (elements.sttSource)    elements.sttSource.setAttribute('disabled', '');
    if (elements.sttEngine)    elements.sttEngine.setAttribute('disabled', '');
    if (elements.openaiApiKey) elements.openaiApiKey.setAttribute('disabled', '');
    showToast('디버그 모드 비활성화', 'info');
  }
}

/**
 * 오디오 소스에 따라 엔진 선택 활성/비활성 및 API 키 그룹 표시/숨김
 */
function updateSttEngineState(source) {
  const isMic = source === 'mic';
  // 디버그 모드일 때만 disabled 상태 변경 (잠금 상태에서는 건드리지 않음)
  if (elements.sttEngine && debugMode) {
    elements.sttEngine.disabled = isMic;
  }
  const engine = isMic ? 'webspeech' : (elements.sttEngine?.value || 'whisper');
  updateOpenaiKeyVisibility(engine);
}

/**
 * 번역 엔진에 따라 API 키 그룹 표시/숨김
 */
function updateTranslationKeyFields(engine) {
  ['google_script', 'papago', 'deepl'].forEach(e => {
    const group = document.getElementById(`apiGroup-${e}`);
    if (group) group.style.display = e === engine ? '' : 'none';
  });
}

/**
 * 엔진에 따라 OpenAI API 키 그룹 표시/숨김
 */
function updateOpenaiKeyVisibility(engine) {
  if (!elements.openaiKeyGroup) return;
  elements.openaiKeyGroup.style.display = engine === 'webspeech' ? 'none' : '';
}

/**
 * 로고 클릭 핸들러 (5번 연속 → 디버그 모드 토글)
 */
function handleLogoClick() {
  logoClickCount++;

  if (logoClickTimer) clearTimeout(logoClickTimer);
  logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 2000);

  if (logoClickCount >= 5) {
    logoClickCount = 0;
    clearTimeout(logoClickTimer);
    toggleDebugMode(!debugMode);
  }
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 로고 클릭 (디버그 모드)
  document.querySelector('.logo')?.addEventListener('click', handleLogoClick);

  // 메인 네비게이션 (잠금 탭 제외 - 기본값, 디버그 모드 시 .locked도 동작)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('locked') && !debugMode) return;
      switchTab(item.getAttribute('data-tab'));
    });
  });

  // 내부 탭
  document.querySelectorAll('.inner-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchInnerTab(tab);
    });
  });

  // 크기 슬라이더
  elements.overlaySize?.addEventListener('input', () => {
    const percent = sliderToPercent(elements.overlaySize.value);
    if (elements.sizeValue) elements.sizeValue.textContent = percent + '%';
  });

  // 불투명도 슬라이더 3개
  elements.fontOpacity?.addEventListener('input', () => {
    if (elements.fontOpacityValue)
      elements.fontOpacityValue.textContent = OPACITY_MAP[elements.fontOpacity.value] + '%';
  });
  elements.bgOpacity?.addEventListener('input', () => {
    if (elements.bgOpacityValue)
      elements.bgOpacityValue.textContent = OPACITY_MAP[elements.bgOpacity.value] + '%';
  });
  elements.windowOpacity?.addEventListener('input', () => {
    if (elements.windowOpacityValue)
      elements.windowOpacityValue.textContent = OPACITY_MAP[elements.windowOpacity.value] + '%';
  });

  // 표시 설정 재설정
  elements.resetDisplayBtn?.addEventListener('click', () => {
    if (elements.fontFamily) elements.fontFamily.value = DISPLAY_DEFAULTS.fontFamily;
    if (elements.fontColor)  elements.fontColor.value  = DISPLAY_DEFAULTS.fontColor;
    if (elements.edgeStyle)  elements.edgeStyle.value  = DISPLAY_DEFAULTS.edgeStyle;
    if (elements.bgColor)    elements.bgColor.value    = DISPLAY_DEFAULTS.bgColor;
    if (elements.windowColor)elements.windowColor.value= DISPLAY_DEFAULTS.windowColor;
    if (elements.overlaySize) {
      elements.overlaySize.value = percentToSlider(DISPLAY_DEFAULTS.overlaySize);
      if (elements.sizeValue) elements.sizeValue.textContent = DISPLAY_DEFAULTS.overlaySize + '%';
    }
    if (elements.fontOpacity) {
      const idx = opacityToSlider(DISPLAY_DEFAULTS.fontOpacity);
      elements.fontOpacity.value = idx;
      if (elements.fontOpacityValue) elements.fontOpacityValue.textContent = OPACITY_MAP[idx] + '%';
    }
    if (elements.bgOpacity) {
      const idx = opacityToSlider(DISPLAY_DEFAULTS.bgOpacity);
      elements.bgOpacity.value = idx;
      if (elements.bgOpacityValue) elements.bgOpacityValue.textContent = OPACITY_MAP[idx] + '%';
    }
    if (elements.windowOpacity) {
      const idx = opacityToSlider(DISPLAY_DEFAULTS.windowOpacity);
      elements.windowOpacity.value = idx;
      if (elements.windowOpacityValue) elements.windowOpacityValue.textContent = OPACITY_MAP[idx] + '%';
    }
    showToast(getMessage('toast_reset', '기본값으로 재설정되었습니다.'), 'info');
    saveSettings(true);
  });

  // STT 버튼
  elements.sttBtn?.addEventListener('click', () => {
    const next   = !sttListening;
    const source = elements.sttSource?.value || 'tab';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return;

      if (!next) {
        // 중지: 소스 무관하게 모두 정지
        setSttState(false);
        chrome.tabs.sendMessage(tab.id, { action: 'stopCapture' }).catch(() => {});
        chrome.runtime.sendMessage({ action: 'stopTabCapture' }).catch(() => {});
        chrome.runtime.sendMessage({ action: 'sttStateChange', active: false, tabId: tab.id }).catch(() => {});
        return;
      }

      if (source === 'tab') {
        // 탭 오디오 캡처 → background 경유
        chrome.runtime.sendMessage({ action: 'startTabCapture', tabId: tab.id }, (response) => {
          if (response?.success) {
            setSttState(true);
            chrome.runtime.sendMessage({ action: 'sttStateChange', active: true, tabId: tab.id }).catch(() => {});
          } else {
            showToast('탭 오디오 캡처 실패: ' + (response?.error || '알 수 없는 오류'), 'error');
          }
        });
      } else {
        // 마이크 (Web Speech API) → content script 경유
        setSttState(true);
        chrome.tabs.sendMessage(tab.id, { action: 'startSttCapture' }).catch(() => {});
        chrome.runtime.sendMessage({ action: 'sttStateChange', active: true, tabId: tab.id }).catch(() => {});
      }
    });
  });

  // sttSource 변경 시 엔진 선택 활성/비활성
  elements.sttSource?.addEventListener('change', () => {
    updateSttEngineState(elements.sttSource.value);
    saveSettings(true);
  });

  // sttEngine 변경 시 API 키 그룹 표시 토글
  elements.sttEngine?.addEventListener('change', () => {
    updateOpenaiKeyVisibility(elements.sttEngine.value);
    saveSettings(true);
  });

  // 번역 엔진 변경 시 키 필드 전환
  elements.translationEngine?.addEventListener('change', () => {
    updateTranslationKeyFields(elements.translationEngine.value);
    saveSettings(true);
  });

  // 자동 저장: 토글 & 셀렉트
  [
    elements.subtitleEnabled, elements.subtitleLang,
    elements.fontFamily, elements.fontColor, elements.edgeStyle,
    elements.bgColor, elements.windowColor,
    elements.showOriginal, elements.overlayPosition, elements.enableCache,
    elements.openaiApiKey,
    elements.googleScriptUrl, elements.papagoApiKey, elements.papagoApiSecret, elements.deeplApiKey,
  ].forEach(el => el?.addEventListener('change', () => saveSettings(true)));

  // 자동 저장: 슬라이더 (500ms debounce)
  [elements.overlaySize, elements.fontOpacity, elements.bgOpacity, elements.windowOpacity]
    .forEach(el => el?.addEventListener('input', scheduleAutoSave));
}

/**
 * 초기화
 */
async function init() {
  initI18n();
  await loadSettings();
  setupEventListeners();
  checkSubtitleStatus();

  // 디버그 모드 및 STT 상태 복원
  chrome.storage.local.get(['debugMode', 'sttListening'], (result) => {
    if (result.debugMode) toggleDebugMode(true);
    if (result.sttListening) setSttState(true);
  });
}

init();

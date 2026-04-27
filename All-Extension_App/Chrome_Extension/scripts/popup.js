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
    sizeLabel.childNodes[0].textContent = getMessage('label_overlaySize', '자막 크기') + ': ';
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

  // 표시 탭
  showOriginal: document.getElementById('showOriginal'),
  overlayPosition: document.getElementById('overlayPosition'),
  overlaySize: document.getElementById('overlaySize'),
  sizeValue: document.getElementById('sizeValue'),
  enableCache: document.getElementById('enableCache'),

  // 공통
  saveBtn: document.getElementById('saveBtn'),
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

// 슬라이더 값↔퍼센트 매핑
const SIZE_MAP = ['50', '75', '100', '150', '200', '250', '300'];

function sliderToPercent(index) {
  return SIZE_MAP[index] || '100';
}

function percentToSlider(percent) {
  const index = SIZE_MAP.indexOf(String(percent));
  return index !== -1 ? index : 2;
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

  // 저장 버튼: 정보 탭에서는 숨김
  elements.saveBtn.style.display = tabName === 'about' ? 'none' : '';
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

      // 표시 설정
      if (elements.showOriginal) elements.showOriginal.checked = settings.showOriginal !== false;
      if (elements.overlayPosition) elements.overlayPosition.value = settings.overlayPosition || 'bottom';
      if (elements.overlaySize) {
        const sizePercent = settings.overlaySize || '100';
        elements.overlaySize.value = percentToSlider(sizePercent);
        if (elements.sizeValue) elements.sizeValue.textContent = sizePercent + '%';
      }
      if (elements.enableCache) elements.enableCache.checked = settings.enableCache !== false;

      resolve(settings);
    });
  });
}

/**
 * 설정 저장
 */
async function saveSettings() {
  const settings = {
    subtitleEnabled: elements.subtitleEnabled?.checked ?? true,
    subtitleLang: elements.subtitleLang?.value || 'auto',
    showOriginal: elements.showOriginal?.checked ?? true,
    overlayPosition: elements.overlayPosition?.value || 'bottom',
    overlaySize: sliderToPercent(elements.overlaySize?.value ?? 2),
    enableCache: elements.enableCache?.checked ?? true,
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
      showToast(getMessage('toast_saved', '설정이 저장되었습니다.'), 'success');
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
    showToast('디버그 모드 비활성화', 'info');
  }
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

  // 슬라이더
  elements.overlaySize?.addEventListener('input', () => {
    const percent = sliderToPercent(elements.overlaySize.value);
    if (elements.sizeValue) elements.sizeValue.textContent = percent + '%';
  });

  // 저장 버튼
  elements.saveBtn?.addEventListener('click', async () => {
    elements.saveBtn.disabled = true;
    try {
      await saveSettings();
    } catch (e) {
      showToast(getMessage('toast_save_error', '설정 저장에 실패했습니다.'), 'error');
    } finally {
      elements.saveBtn.disabled = false;
    }
  });

  // Ctrl+S / Cmd+S
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveSettings();
    }
  });
}

/**
 * 초기화
 */
async function init() {
  initI18n();
  await loadSettings();
  setupEventListeners();
  checkSubtitleStatus();

  // 디버그 모드 복원
  chrome.storage.local.get(['debugMode'], (result) => {
    if (result.debugMode) toggleDebugMode(true);
  });
}

init();

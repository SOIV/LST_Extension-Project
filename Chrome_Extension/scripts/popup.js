/**
 * Live Stream Translator - Popup Script (with Sidebar Navigation)
 */

// DOM 요소
const elements = {
  // 폼 요소
  sourceLang: document.getElementById('sourceLang'),
  targetLang: document.getElementById('targetLang'),
  translationEngine: document.getElementById('translationEngine'),
  apiKey: document.getElementById('apiKey'),
  apiSecret: document.getElementById('apiSecret'),
  apiKeyGroup: document.getElementById('apiKeyGroup'),
  apiSecretGroup: document.getElementById('apiSecretGroup'),
  showOriginal: document.getElementById('showOriginal'),
  overlayPosition: document.getElementById('overlayPosition'),
  overlaySize: document.getElementById('overlaySize'),
  sizeValue: document.getElementById('sizeValue'),
  enableCache: document.getElementById('enableCache'),

  // 상태 요소
  webSpeechStatus: document.getElementById('webSpeechStatus'),
  cacheStatus: document.getElementById('cacheStatus'),
  clearCacheBtn: document.getElementById('clearCacheBtn'),
  resetSettingsBtn: document.getElementById('resetSettingsBtn'),
  saveBtn: document.getElementById('saveBtn'),
  helpLink: document.getElementById('helpLink'),

  // 네비게이션
  navItems: document.querySelectorAll('.nav-item'),
  tabContents: document.querySelectorAll('.tab-content'),
  pageTitle: document.getElementById('pageTitle')
};

// 탭 제목 매핑
const tabTitles = {
  'language': '언어 설정',
  'translation': '번역 엔진',
  'display': '표시 옵션',
  'status': '상태',
  'about': '정보'
};

// 슬라이더 값과 퍼센트 매핑
const sizeMap = ['50', '75', '100', '150', '200', '250', '300'];

/**
 * 슬라이더 인덱스를 퍼센트 값으로 변환
 */
function sliderToPercent(index) {
  return sizeMap[index] || '100';
}

/**
 * 퍼센트 값을 슬라이더 인덱스로 변환
 */
function percentToSlider(percent) {
  const index = sizeMap.indexOf(String(percent));
  return index !== -1 ? index : 2; // 기본값 100% = index 2
}

/**
 * 초기화
 */
async function init() {
  // 설정 로드
  await loadSettings();

  // Web Speech API 상태 확인
  checkWebSpeechSupport();

  // 이벤트 리스너 등록
  setupEventListeners();

  // 캐시 상태 업데이트
  updateCacheStatus();

  console.log('Popup initialized');
}

/**
 * 설정 로드
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (settings) => {
      // 언어 설정
      elements.sourceLang.value = settings.sourceLang || 'auto';
      elements.targetLang.value = settings.targetLang || 'ko';

      // 번역 엔진
      elements.translationEngine.value = settings.translationEngine || 'google';

      // API 키
      elements.apiKey.value = settings.apiKey || '';
      elements.apiSecret.value = settings.apiSecret || '';

      // 표시 옵션
      elements.showOriginal.checked = settings.showOriginal !== false;
      elements.overlayPosition.value = settings.overlayPosition || 'bottom';

      // 슬라이더 값 설정
      const sizePercent = settings.overlaySize || '100';
      elements.overlaySize.value = percentToSlider(sizePercent);
      elements.sizeValue.textContent = sizePercent + '%';

      elements.enableCache.checked = settings.enableCache !== false;

      // API 키 필드 표시/숨김
      updateAPIKeyVisibility();

      console.log('Settings loaded:', settings);
      resolve(settings);
    });
  });
}

/**
 * 설정 저장
 */
async function saveSettings() {
  const settings = {
    sourceLang: elements.sourceLang.value,
    targetLang: elements.targetLang.value,
    translationEngine: elements.translationEngine.value,
    apiKey: elements.apiKey.value.trim(),
    apiSecret: elements.apiSecret.value.trim(),
    showOriginal: elements.showOriginal.checked,
    overlayPosition: elements.overlayPosition.value,
    overlaySize: sliderToPercent(elements.overlaySize.value),
    enableCache: elements.enableCache.checked
  };

  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      console.log('Settings saved:', settings);

      // 활성 탭에 설정 업데이트 알림
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'updateSettings' })
            .catch(err => console.log('Tab not ready:', err));
        }
      });

      showToast('설정이 저장되었습니다.', 'success');
      resolve(settings);
    });
  });
}

/**
 * API 키 필드 표시/숨김
 */
function updateAPIKeyVisibility() {
  const engine = elements.translationEngine.value;

  if (engine === 'google') {
    elements.apiKeyGroup.style.display = 'none';
    elements.apiSecretGroup.style.display = 'none';
  } else if (engine === 'papago') {
    elements.apiKeyGroup.style.display = 'block';
    elements.apiSecretGroup.style.display = 'block';
  } else if (engine === 'deepl') {
    elements.apiKeyGroup.style.display = 'block';
    elements.apiSecretGroup.style.display = 'none';
  }
}

/**
 * Web Speech API 지원 확인
 */
function checkWebSpeechSupport() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      elements.webSpeechStatus.textContent = '탭을 확인할 수 없음';
      elements.webSpeechStatus.classList.remove('success');
      elements.webSpeechStatus.classList.add('error');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, { action: 'checkWebSpeech' }, (response) => {
      if (chrome.runtime.lastError) {
        elements.webSpeechStatus.textContent = '확인 불가';
        elements.webSpeechStatus.classList.remove('success', 'error');
        return;
      }

      if (response && response.supported) {
        elements.webSpeechStatus.textContent = '지원됨 ✓';
        elements.webSpeechStatus.classList.add('success');
        elements.webSpeechStatus.classList.remove('error');
      } else {
        elements.webSpeechStatus.textContent = '지원되지 않음 ✗';
        elements.webSpeechStatus.classList.add('error');
        elements.webSpeechStatus.classList.remove('success');
      }
    });
  });
}

/**
 * 캐시 상태 업데이트
 */
function updateCacheStatus() {
  chrome.storage.local.get(['translationCache'], (result) => {
    const cache = result.translationCache || {};
    const size = Object.keys(cache).length;
    elements.cacheStatus.textContent = `${size}개 항목`;
  });
}

/**
 * 캐시 지우기
 */
function clearCache() {
  if (!confirm('번역 캐시를 모두 삭제하시겠습니까?')) {
    return;
  }

  chrome.storage.local.remove(['translationCache'], () => {
    console.log('Translation cache cleared');
    updateCacheStatus();
    showToast('캐시가 삭제되었습니다.', 'success');
  });
}

/**
 * 설정 초기화
 */
async function resetSettings() {
  if (!confirm('모든 설정을 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
    return;
  }

  const defaultSettings = {
    sourceLang: 'auto',
    targetLang: 'ko',
    translationEngine: 'google',
    apiKey: '',
    apiSecret: '',
    showOriginal: true,
    overlayPosition: 'bottom',
    overlaySize: '100',
    enableCache: true
  };

  return new Promise((resolve) => {
    chrome.storage.sync.set(defaultSettings, () => {
      console.log('Settings reset to defaults:', defaultSettings);

      // UI 업데이트
      loadSettings();

      // 캐시도 함께 삭제
      chrome.storage.local.remove(['translationCache'], () => {
        updateCacheStatus();
      });

      // 활성 탭에 설정 업데이트 알림
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'updateSettings' })
            .catch(err => console.log('Tab not ready:', err));
        }
      });

      showToast('설정이 초기화되었습니다.', 'success');
      resolve();
    });
  });
}

/**
 * 탭 전환
 */
function switchTab(tabName) {
  // 모든 탭 비활성화
  elements.tabContents.forEach(tab => {
    tab.classList.remove('active');
  });

  // 모든 네비게이션 아이템 비활성화
  elements.navItems.forEach(item => {
    item.classList.remove('active');
  });

  // 선택된 탭 활성화
  const selectedTab = document.getElementById(`tab-${tabName}`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // 선택된 네비게이션 아이템 활성화
  const selectedNavItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (selectedNavItem) {
    selectedNavItem.classList.add('active');
  }

  // 페이지 제목 업데이트
  elements.pageTitle.textContent = tabTitles[tabName] || '설정';

  console.log('Switched to tab:', tabName);
}

/**
 * 토스트 알림 표시
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
 * 도움말 표시
 */
function showHelp() {
  const helpText = `
=== Live Stream Translator 사용 방법 ===

1. 지원 플랫폼
   - YouTube / YouTube Live
   - Twitch
   - SOOP (구 아프리카TV)
   - 치지직 (Chzzk)
   - 니코니코동화

2. 사용 방법
   ① 스트리밍 페이지로 이동
   ② Extension 아이콘 클릭
   ③ 실시간 번역 자막 표시
   ④ 중지하려면 아이콘 다시 클릭

3. 번역 엔진
   - Google: 무료, API 키 불필요
   - Papago: 한국어 최적화, API 키 필요
   - DeepL: 고품질, API 키 필요

4. API 키 발급
   - Papago: https://www.ncloud.com/
   - DeepL: https://www.deepl.com/pro-api

5. 문제 해결
   - 음성 인식 안 됨: 페이지 새로고침
   - 번역 안 됨: API 키 확인
   - 자막 안 보임: 오버레이 위치 변경
  `.trim();

  alert(helpText);
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 네비게이션 아이템 클릭
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // 번역 엔진 변경 시
  elements.translationEngine.addEventListener('change', () => {
    updateAPIKeyVisibility();
  });

  // 자막 크기 슬라이더
  elements.overlaySize.addEventListener('input', () => {
    const percent = sliderToPercent(elements.overlaySize.value);
    elements.sizeValue.textContent = percent + '%';
  });

  // 저장 버튼
  elements.saveBtn.addEventListener('click', async () => {
    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = '저장 중...';

    try {
      await saveSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('설정 저장에 실패했습니다.', 'error');
    } finally {
      elements.saveBtn.disabled = false;
      elements.saveBtn.textContent = '저장';
    }
  });

  // 캐시 지우기 버튼
  elements.clearCacheBtn.addEventListener('click', clearCache);

  // 설정 초기화 버튼
  elements.resetSettingsBtn.addEventListener('click', async () => {
    elements.resetSettingsBtn.disabled = true;
    elements.resetSettingsBtn.textContent = '초기화 중...';

    try {
      await resetSettings();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      showToast('설정 초기화에 실패했습니다.', 'error');
    } finally {
      elements.resetSettingsBtn.disabled = false;
      elements.resetSettingsBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 8px;">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        설정 초기화
      `;
    }
  });

  // 도움말 링크
  elements.helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    showHelp();
  });

  // 키보드 단축키 (Ctrl+S / Cmd+S)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveSettings();
    }
  });
}

// 초기화 실행
init();

console.log('Live Stream Translator Popup loaded');

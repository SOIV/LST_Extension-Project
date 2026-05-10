/**
 * LST - Community Subtitle Init
 * 커뮤니티 자막 시스템 초기화 + 플레이어 패널 버튼 주입 + 팝업 메시지 처리
 */

(function () {
  let subtitleStatus    = 'loading';
  let subtitleLanguages = [];
  let currentSettings   = {};
  let subtitleTrackInfo = null;

  /* ─── 패널 업데이트 ─────────────────────────────────────── */

  function syncPanel(status, languages, trackInfo) {
    LSTPanel.update({
      // 기본 상태
      enabled:   currentSettings.subtitleEnabled !== false,
      lang:      currentSettings.subtitleLang || 'auto',
      languages: languages || [],
      info:      status === 'available' ? (trackInfo || null) : null,
      // 표시 설정 (팝업 공통 설정과 동기화)
      fontFamily:    currentSettings.fontFamily    || 'proportional-sans-serif',
      fontColor:     currentSettings.fontColor     || 'white',
      fontOpacity:   currentSettings.fontOpacity   || '100',
      overlaySize:   currentSettings.overlaySize   || '100',
      edgeStyle:     currentSettings.edgeStyle     || 'drop-shadow',
      bgColor:       currentSettings.bgColor       || 'black',
      bgOpacity:     currentSettings.bgOpacity     || '75',
      windowColor:   currentSettings.windowColor   || 'black',
      windowOpacity: currentSettings.windowOpacity || '0',
      // 콜백
      onToggle: (enabled) => {
        currentSettings.subtitleEnabled = enabled;
        if (chrome.runtime?.id) chrome.storage.sync.set({ subtitleEnabled: enabled });
        SubtitleLoader.updateSettings({ subtitleEnabled: enabled });
      },
      onLangChange: (lang) => {
        currentSettings.subtitleLang = lang;
        if (chrome.runtime?.id) chrome.storage.sync.set({ subtitleLang: lang });
        SubtitleLoader.updateSettings({ subtitleLang: lang });
      },
      onSettingChange: (changed) => {
        Object.assign(currentSettings, changed);
        if (chrome.runtime?.id) chrome.storage.sync.set(changed);
        SubtitleLoader.updateSettings(changed);
      },
    });
  }

  /* ─── 자막 상태 콜백 ────────────────────────────────────── */

  function onStatusChange(status, languages, trackInfo) {
    subtitleStatus    = status;
    subtitleLanguages = languages || [];
    subtitleTrackInfo = status === 'available' ? (trackInfo || null) : null;

    // 배지 업데이트 (컨텍스트 무효화 시 무시)
    if (chrome.runtime?.id) {
      try {
        chrome.runtime.sendMessage({ action: 'subtitleStatus', status }).catch(() => {});
      } catch (_) {}
    }

    // 패널 동기화
    syncPanel(status, subtitleLanguages, subtitleTrackInfo);
  }

  /* ─── 버튼 주입 ─────────────────────────────────────────── */

  /**
   * .ytp-settings-button이 DOM에 나타날 때까지 재시도
   * YouTube SPA 전환 후에도 재주입 가능
   */
  function tryInjectButton(retries = 15) {
    if (document.getElementById('lst-panel-btn')) return; // 이미 있음

    if (document.querySelector('.ytp-settings-button')) {
      LSTPanel.injectButton();
      return;
    }

    if (retries > 0) {
      setTimeout(() => tryInjectButton(retries - 1), 400);
    }
  }

  /* ─── SPA 네비게이션 감지 (버튼 재주입용) ─────────────────── */

  let lastHref = location.href;

  const navObserver = new MutationObserver(() => {
    if (!chrome.runtime?.id) {
      navObserver.disconnect();
      return;
    }
    if (location.href !== lastHref) {
      lastHref = location.href;
      // 패널/버튼 제거 후 재주입 대기
      LSTPanel.destroy();
      setTimeout(() => tryInjectButton(), 1200);
    }
  });

  navObserver.observe(document.body, { childList: true, subtree: true });

  /* ─── 초기화 ─────────────────────────────────────────────── */

  chrome.storage.sync.get(null, (settings) => {
    currentSettings = settings || {};
    SubtitleLoader.init(currentSettings, onStatusChange);
    tryInjectButton();
  });

  /* ─── 팝업 메시지 처리 ──────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.action) {

      // 팝업이 자막 상태 요청
      case 'getSubtitleStatus':
        sendResponse({ status: subtitleStatus, languages: subtitleLanguages });
        break;

      // 팝업에서 설정 저장 후 content script에 알림
      case 'updateSettings':
        if (message.settings) {
          Object.assign(currentSettings, message.settings);
          SubtitleLoader.updateSettings(message.settings);
          // 패널 토글/언어 표시 동기화
          syncPanel(subtitleStatus, subtitleLanguages, subtitleTrackInfo);
        }
        sendResponse({ success: true });
        break;

      default:
        break;
    }
    return false;
  });
})();

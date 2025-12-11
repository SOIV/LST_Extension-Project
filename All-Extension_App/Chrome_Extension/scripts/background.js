/**
 * Live Stream Translator - Background Service Worker
 * Chrome Extension Manifest V3
 *
 * 역할:
 * - Extension 아이콘 클릭 감지
 * - chrome.tabCapture 권한 관리
 * - Offscreen Document 생성 및 관리
 * - Content Script와 통신
 * - 캡처 상태 관리
 */

// 탭별 캡처 상태 관리
const captureStates = new Map();

// Extension 아이콘 클릭 시
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 지원하는 플랫폼인지 확인
    if (!isSupportedPlatform(tab.url)) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Live Stream Translator',
        message: '지원하지 않는 플랫폼입니다. YouTube, Twitch, SOOP, 치지직, 니코니코를 지원합니다.'
      });
      return;
    }

    const isCapturing = captureStates.get(tab.id);

    if (isCapturing) {
      // 캡처 중지
      await stopCapture(tab.id);
    } else {
      // 캡처 시작
      await startCapture(tab.id);
    }
  } catch (error) {
    console.error('Extension action error:', error);
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Live Stream Translator - 오류',
      message: `오류가 발생했습니다: ${error.message}`
    });
  }
});

/**
 * 캡처 시작
 */
async function startCapture(tabId) {
  try {
    // MediaStream ID 획득
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId
    });

    // Content Script에 streamId 전달
    await chrome.tabs.sendMessage(tabId, {
      action: 'startCapture',
      streamId: streamId
    });

    // 상태 업데이트
    captureStates.set(tabId, true);
    updateIcon(tabId, true);

    console.log(`Capture started for tab ${tabId}`);
  } catch (error) {
    console.error('Failed to start capture:', error);
    throw error;
  }
}

/**
 * 캡처 중지
 */
async function stopCapture(tabId) {
  try {
    // Content Script에 중지 신호 전달
    await chrome.tabs.sendMessage(tabId, {
      action: 'stopCapture'
    });

    // 상태 업데이트
    captureStates.delete(tabId);
    updateIcon(tabId, false);

    console.log(`Capture stopped for tab ${tabId}`);
  } catch (error) {
    console.error('Failed to stop capture:', error);
  }
}

/**
 * 아이콘 상태 업데이트
 */
function updateIcon(tabId, isCapturing) {
  const iconPath = isCapturing ? {
    16: 'icons/icon16-active.png',
    32: 'icons/icon32-active.png',
    48: 'icons/icon48-active.png',
    128: 'icons/icon128-active.png'
  } : {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png'
  };

  chrome.action.setIcon({ tabId, path: iconPath });
}

/**
 * 지원하는 플랫폼인지 확인
 */
function isSupportedPlatform(url) {
  const supportedPlatforms = [
    /^https?:\/\/(www\.)?youtube\.com\//,
    /^https?:\/\/(www\.)?twitch\.tv\//,
    /^https?:\/\/play\.sooplive\.co\.kr\//,
    /^https?:\/\/chzzk\.naver\.com\//,
    /^https?:\/\/(www\.|live\.)?nicovideo\.jp\//
  ];

  return supportedPlatforms.some(pattern => pattern.test(url));
}

/**
 * 탭 닫힘 시 정리
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (captureStates.has(tabId)) {
    captureStates.delete(tabId);
    console.log(`Tab ${tabId} closed, state cleaned up`);
  }
});

/**
 * Content Script로부터 메시지 수신
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.action) {
    case 'captureStarted':
      captureStates.set(tabId, true);
      updateIcon(tabId, true);
      sendResponse({ success: true });
      break;

    case 'captureStopped':
      captureStates.delete(tabId);
      updateIcon(tabId, false);
      sendResponse({ success: true });
      break;

    case 'captureError':
      captureStates.delete(tabId);
      updateIcon(tabId, false);
      console.error('Capture error from content script:', message.error);
      sendResponse({ success: false });
      break;

    case 'getSettings':
      // 설정 불러오기
      chrome.storage.sync.get(null, (settings) => {
        sendResponse({ settings });
      });
      return true; // 비동기 응답

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return false;
});

/**
 * Extension 설치/업데이트 시
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // 기본 설정 저장
    await chrome.storage.sync.set({
      sourceLang: 'auto',
      targetLang: 'ko',
      translationEngine: 'google',
      showOriginal: true,
      overlayPosition: 'bottom',
      overlaySize: '100',
      enableCache: true
    });

    console.log('Live Stream Translator installed with default settings');
  } else if (details.reason === 'update') {
    console.log('Live Stream Translator updated to version', chrome.runtime.getManifest().version);
  }
});

console.log('Live Stream Translator Background Service Worker loaded');

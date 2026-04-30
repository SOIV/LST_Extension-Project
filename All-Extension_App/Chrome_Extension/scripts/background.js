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
};

function updateBadge(tabId, status) {
  const b = BADGE[status] ?? BADGE.unavailable;
  chrome.action.setBadgeText({ tabId, text: b.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
}

// ─── 메시지 수신 (content script → background) ────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (message.action === 'subtitleStatus') {
    const { status } = message;
    tabSubtitleStatus.set(tabId, status);
    updateBadge(tabId, status);
  }
});

// ─── 탭 정리 ──────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  tabSubtitleStatus.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // 페이지 이동 시 배지 초기화
  if (changeInfo.status === 'loading') {
    updateBadge(tabId, 'loading');
  }
});

// ─── 설치 / 업데이트 ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      subtitleEnabled:  true,
      subtitleLang:     'auto',
      overlayPosition:  'bottom',
      overlaySize:      '100',
      enableCache:      true,
    });
    console.log('[LST] Installed — default settings applied');
  }
});

/**
 * LST - Community Subtitle Init
 * Phase 2: 커뮤니티 자막 시스템 초기화 + 팝업 메시지 처리
 */

(function () {
  let subtitleStatus = 'loading';
  let subtitleLanguages = [];

  function onStatusChange(status, languages) {
    subtitleStatus    = status;
    subtitleLanguages = languages || [];
    // background에 상태 전달 → 배지 업데이트
    chrome.runtime.sendMessage({ action: 'subtitleStatus', status }).catch(() => {});
  }

  // 설정 로드 후 초기화
  chrome.storage.sync.get(null, (settings) => {
    SubtitleLoader.init(settings, onStatusChange);
  });

  // 팝업 메시지 처리
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.action) {

      // 팝업이 자막 상태 요청
      case 'getSubtitleStatus':
        sendResponse({ status: subtitleStatus, languages: subtitleLanguages });
        break;

      // 팝업에서 설정 저장 후 content script에 알림
      case 'updateSettings':
        if (message.settings) {
          SubtitleLoader.updateSettings(message.settings);
        }
        sendResponse({ success: true });
        break;

      default:
        break;
    }
    return false;
  });
})();

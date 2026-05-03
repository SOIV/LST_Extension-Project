/**
 * LST - Subtitle Loader
 * YouTube 영상 ID 감지 → 플랫폼 API 자막 조회 → SubtitleRenderer에 전달
 */

const SubtitleLoader = (() => {
  const API_BASE = 'https://lst-pj.soiv-studio.xyz/api';

  let currentVideoId = null;
  let settings       = {};
  let statusCallback = null;
  let spaObserver    = null;
  let lastUrl        = location.href;
  let loadRequestId  = 0;

  /* ─── 유틸 ─────────────────────────────────────────────── */

  function getVideoId() {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('v') || null;
    } catch {
      return null;
    }
  }

  function isYouTubeVideoPage() {
    return location.hostname.includes('youtube.com') && !!getVideoId();
  }

  /* ─── API 호출 ─────────────────────────────────────────── */

  async function fetchSubtitle(videoId, lang) {
    const params = new URLSearchParams({ videoId });
    if (lang && lang !== 'auto') params.set('lang', lang);

    try {
      const res = await fetch(`${API_BASE}/subtitles?${params}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      // 서버 무응답 / 네트워크 오류 → 조용히 실패
      return null;
    }
  }

  /* ─── 로드 ─────────────────────────────────────────────── */

  async function load() {
    const requestId = ++loadRequestId;

    if (!isYouTubeVideoPage()) {
      if (requestId !== loadRequestId) return;
      setStatus('not_youtube');
      SubtitleRenderer.clear();
      currentVideoId = null;
      return;
    }

    const videoId = getVideoId();

    // 같은 영상이면 스킵
    if (videoId === currentVideoId) return;
    currentVideoId = videoId;

    setStatus('loading');
    SubtitleRenderer.clear();

    const data = await fetchSubtitle(videoId, settings.subtitleLang);
    if (requestId !== loadRequestId || currentVideoId !== videoId) return;

    if (!data || !data.content) {
      setStatus('unavailable');
      return;
    }

    const { cues, hasExplicitPosition } = SubtitleParser.parse(data.content, data.format);
    if (requestId !== loadRequestId || currentVideoId !== videoId) return;

    if (cues.length === 0) {
      setStatus('unavailable');
      return;
    }

    SubtitleRenderer.load(cues, settings, hasExplicitPosition);
    setStatus('available', data.languages || [], { format: data.format });
  }

  function setStatus(status, languages, trackInfo) {
    if (statusCallback) statusCallback(status, languages, trackInfo);
  }

  /* ─── SPA 네비게이션 감지 ───────────────────────────────── */

  function startSPAObserver() {
    if (spaObserver) return;

    spaObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        currentVideoId = null;
        // 페이지 전환 직후는 DOM이 아직 준비 안 됐을 수 있어 잠깐 대기
        setTimeout(load, 1200);
      }
    });

    spaObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── 공개 API ─────────────────────────────────────────── */

  /**
   * 초기화
   * @param {object} initialSettings - chrome.storage에서 불러온 설정
   * @param {function} onStatus - (status, languages?) 콜백
   */
  function init(initialSettings, onStatus) {
    settings       = initialSettings || {};
    statusCallback = onStatus;

    load();
    startSPAObserver();
  }

  /**
   * 설정 업데이트 (팝업에서 저장 시 호출)
   * @param {object} newSettings
   */
  function updateSettings(newSettings) {
    const langChanged = newSettings.subtitleLang &&
                        newSettings.subtitleLang !== settings.subtitleLang;

    settings = { ...settings, ...newSettings };
    SubtitleRenderer.updateSettings(newSettings);

    // 언어 변경 시 자막 재로드
    if (langChanged) {
      currentVideoId = null;
      load();
    }
  }

  /**
   * 현재 자막 상태 반환 (팝업 getSubtitleStatus 메시지 응답용)
   */
  function getCurrentStatus() {
    if (!isYouTubeVideoPage()) return { status: 'not_youtube' };
    if (!currentVideoId)       return { status: 'loading' };
    return { status: 'available' };   // 실제 상태는 statusCallback으로 관리
  }

  return { init, updateSettings, getCurrentStatus };
})();

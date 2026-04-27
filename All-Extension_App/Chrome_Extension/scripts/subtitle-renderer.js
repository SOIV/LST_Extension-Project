/**
 * LST - Subtitle Renderer
 * YouTube 영상 위 자막 오버레이 렌더링
 */

const SubtitleRenderer = (() => {
  const OVERLAY_ID  = 'lst-subtitle-overlay';
  const TEXT_ID     = 'lst-subtitle-text';

  let cues     = [];
  let settings = {};
  let rafId    = null;
  let videoEl  = null;

  const SIZE_MAP = {
    '50': '11px', '75': '14px', '100': '18px',
    '150': '22px', '200': '26px', '250': '30px', '300': '34px'
  };

  /* ─── DOM 헬퍼 ─────────────────────────────────────────── */

  function getVideo() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function getPlayerContainer() {
    return document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  }

  function getOrCreateOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) return existing;

    const container = getPlayerContainer();
    if (!container) return null;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    Object.assign(overlay.style, {
      position:       'absolute',
      left:           '0',
      right:          '0',
      pointerEvents:  'none',
      zIndex:         '100',
      display:        'flex',
      justifyContent: 'center',
      padding:        '0 48px',
    });

    const text = document.createElement('div');
    text.id = TEXT_ID;
    Object.assign(text.style, {
      background:   'rgba(0,0,0,0.75)',
      color:        '#fff',
      padding:      '6px 16px',
      borderRadius: '4px',
      fontSize:     '18px',
      lineHeight:   '1.5',
      textAlign:    'center',
      maxWidth:     '80%',
      whiteSpace:   'pre-line',
      display:      'none',
    });

    overlay.appendChild(text);
    container.appendChild(overlay);
    return overlay;
  }

  function applyPosition(overlay) {
    const pos = settings.overlayPosition || 'bottom';
    overlay.style.top       = '';
    overlay.style.bottom    = '';
    overlay.style.transform = '';
    if (pos === 'top') {
      overlay.style.top = '8%';
    } else if (pos === 'middle') {
      overlay.style.top       = '50%';
      overlay.style.transform = 'translateY(-50%)';
    } else {
      overlay.style.bottom = '10%';
    }
  }

  /* ─── 렌더 루프 ──────────────────────────────────────────── */

  function tick() {
    rafId = requestAnimationFrame(tick);

    const video = videoEl || getVideo();
    if (!video) return;
    videoEl = video;

    const overlay = getOrCreateOverlay();
    if (!overlay) return;

    const text = document.getElementById(TEXT_ID);
    if (!text) return;

    if (!settings.subtitleEnabled) {
      text.style.display = 'none';
      return;
    }

    const nowMs    = video.currentTime * 1000;
    const activeCue = cues.find(c => nowMs >= c.start && nowMs <= c.end);

    if (activeCue) {
      if (text.textContent !== activeCue.text) {
        text.textContent = activeCue.text;
      }
      text.style.fontSize = SIZE_MAP[settings.overlaySize || '100'] || '18px';
      text.style.display  = 'block';
      applyPosition(overlay);
    } else {
      text.style.display = 'none';
    }
  }

  /* ─── 공개 API ──────────────────────────────────────────── */

  /**
   * 자막 로드 및 렌더 시작
   * @param {{ start: number, end: number, text: string }[]} subtitleCues
   * @param {object} newSettings
   */
  function load(subtitleCues, newSettings) {
    clear();
    cues     = subtitleCues || [];
    settings = newSettings  || {};

    if (cues.length > 0) {
      getOrCreateOverlay();
      tick();
    }
  }

  /**
   * 설정만 업데이트 (자막 유지)
   */
  function updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
  }

  /**
   * 자막 및 오버레이 제거
   */
  function clear() {
    cues    = [];
    videoEl = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
  }

  return { load, updateSettings, clear };
})();

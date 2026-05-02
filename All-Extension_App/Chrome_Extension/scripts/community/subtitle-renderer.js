/**
 * LST - Subtitle Renderer
 * YouTube 영상 위 자막 오버레이 렌더링
 *
 * [재생바 자동 회피]
 * - overlayPosition === 'bottom' && hasExplicitPosition === false 일 때 활성화
 * - #movie_player에서 'ytp-autohide' 클래스 변화를 MutationObserver로 감지
 *   · 클래스 없음(재생바 표시) → .ytp-chrome-bottom 높이만큼 위로 이동
 *   · 클래스 있음(재생바 숨김)  → 기본 bottom 위치 복귀
 * - 파일에 위치 정보가 포함된 경우(hasExplicitPosition) 옵저버 비활성화 → YouTube 동일 동작
 */

const SubtitleRenderer = (() => {
  const OVERLAY_ID  = 'lst-subtitle-overlay';
  const TEXT_ID     = 'lst-subtitle-text';

  let cues                = [];
  let settings            = {};
  let rafId               = null;
  let videoEl             = null;
  let hasExplicitPosition = false;  // 자막 파일에 고정 위치 정보 포함 여부
  let controlsVisible     = false;  // 재생바 표시 상태
  let controlsObserver    = null;   // MutationObserver 인스턴스

  // ─── 스타일 맵 ──────────────────────────────────────────────

  const SIZE_MAP = {
    '50': '11px', '75': '14px', '100': '18px',
    '150': '22px', '200': '26px', '300': '30px', '400': '36px'
  };

  const FONT_FAMILY_MAP = {
    'proportional-sans-serif': 'Arial, Helvetica, sans-serif',
    'proportional-serif':      '"Times New Roman", Times, Georgia, serif',
    'monospace-serif':         '"Courier New", Courier, monospace',
    'monospace-sans-serif':    '"Lucida Console", Monaco, Consolas, monospace',
    'casual':                  '"Comic Sans MS", Impact, fantasy',
    'cursive':                 'Pacifico, "Arial Rounded MT Bold", cursive',
    'small-caps':              'Arial, Helvetica, sans-serif',
  };

  const COLOR_MAP = {
    white:   '#ffffff', yellow:  '#ffff00', green:   '#00ff00',
    cyan:    '#00ffff', blue:    '#0000ff', magenta: '#ff00ff',
    red:     '#ff0000', black:   '#000000',
  };

  const EDGE_STYLE_MAP = {
    none:          'none',
    raised:        '1px 1px 0 #000, 1px 0 0 #000, 0 1px 0 #000',
    depressed:     '-1px -1px 0 #888, 0 -1px 0 #888, -1px 0 0 #888',
    uniform:       '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000',
    'drop-shadow': '2px 2px 3px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.9)',
  };

  /** 색상 이름 + 불투명도(0~100) → rgba() 문자열 */
  function toRgba(colorKey, opacityStr) {
    const hex   = COLOR_MAP[colorKey] || '#000000';
    const r     = parseInt(hex.slice(1, 3), 16);
    const g     = parseInt(hex.slice(3, 5), 16);
    const b     = parseInt(hex.slice(5, 7), 16);
    const alpha = parseInt(opacityStr ?? '100', 10) / 100;
    return `rgba(${r},${g},${b},${alpha})`;
  }

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
      padding:      '6px 16px',
      borderRadius: '4px',
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

  /* ─── 재생바 자동 회피 ──────────────────────────────────── */

  /**
   * 현재 재생바 상태에 따른 overlay bottom 값 계산
   * - 재생바 숨김 또는 고정 위치 파일: '5%'
   * - 재생바 표시: .ytp-chrome-bottom 높이 + 여백
   */
  function getAutoBottom() {
    if (hasExplicitPosition || !controlsVisible) return '5%';
    const bar = document.querySelector('.ytp-chrome-bottom');
    const barH = bar ? bar.offsetHeight : 48;
    return `${barH + 4}px`;
  }

  /**
   * #movie_player의 'ytp-autohide' 클래스 변화 감시
   * - ytp-autohide 없음 = 재생바 표시
   * - ytp-autohide 있음 = 재생바 숨김
   */
  function startControlsObserver(retries = 5) {
    stopControlsObserver();

    const player = getPlayerContainer();
    if (!player) {
      if (retries > 0) setTimeout(() => startControlsObserver(retries - 1), 800);
      return;
    }

    // 초기 상태 반영
    controlsVisible = !player.classList.contains('ytp-autohide');

    controlsObserver = new MutationObserver(() => {
      const nowVisible = !player.classList.contains('ytp-autohide');
      if (nowVisible === controlsVisible) return;
      controlsVisible = nowVisible;

      // bottom 위치만 즉시 업데이트 (전체 applyStyles 불필요)
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay && (settings.overlayPosition || 'bottom') === 'bottom') {
        overlay.style.bottom = getAutoBottom();
      }
    });

    controlsObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
  }

  function stopControlsObserver() {
    if (controlsObserver) {
      controlsObserver.disconnect();
      controlsObserver = null;
    }
  }

  /** 현재 설정에 따라 옵저버 on/off 결정 */
  function syncControlsObserver() {
    const needsObserver =
      !hasExplicitPosition &&
      (settings.overlayPosition || 'bottom') === 'bottom';

    if (needsObserver) {
      startControlsObserver();
    } else {
      stopControlsObserver();
      controlsVisible = false;
    }
  }

  /* ─── 스타일 적용 ───────────────────────────────────────── */

  function applyStyles(overlay, text) {
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
      // bottom: 재생바 상태에 따라 동적으로 결정
      overlay.style.bottom = getAutoBottom();
    }

    // 창 배경
    overlay.style.background = toRgba(
      settings.windowColor   || 'black',
      settings.windowOpacity ?? '0'
    );

    // 글꼴 크기
    text.style.fontSize = SIZE_MAP[settings.overlaySize || '100'] || '18px';

    // 글꼴 패밀리 + Small Caps
    const family = settings.fontFamily || 'proportional-sans-serif';
    text.style.fontFamily  = FONT_FAMILY_MAP[family] || FONT_FAMILY_MAP['proportional-sans-serif'];
    text.style.fontVariant = family === 'small-caps' ? 'small-caps' : '';

    // 글꼴 색상
    text.style.color      = toRgba(settings.fontColor || 'white', settings.fontOpacity ?? '100');

    // 글자 테두리
    text.style.textShadow = EDGE_STYLE_MAP[settings.edgeStyle || 'drop-shadow'] || EDGE_STYLE_MAP['drop-shadow'];

    // 배경
    text.style.background   = toRgba(settings.bgColor || 'black', settings.bgOpacity ?? '75');
    text.style.padding      = '6px 16px';
    text.style.borderRadius = '4px';
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

    if (settings.subtitleEnabled === false) {
      text.style.display = 'none';
      return;
    }

    const nowMs     = video.currentTime * 1000;
    const activeCue = cues.find(c => nowMs >= c.start && nowMs <= c.end);

    if (activeCue) {
      if (text.textContent !== activeCue.text) {
        text.textContent = activeCue.text;
      }
      applyStyles(overlay, text);
      text.style.display = 'block';
    } else {
      text.style.display = 'none';
    }
  }

  /* ─── 공개 API ──────────────────────────────────────────── */

  /**
   * 자막 로드 및 렌더 시작
   * @param {{ start: number, end: number, text: string }[]} subtitleCues
   * @param {object} newSettings
   * @param {boolean} [explicitPosition=false] - 자막 파일에 고정 위치 정보 포함 여부
   */
  function load(subtitleCues, newSettings, explicitPosition = false) {
    clear();
    cues                = subtitleCues || [];
    settings            = newSettings  || {};
    hasExplicitPosition = explicitPosition;

    if (cues.length > 0) {
      getOrCreateOverlay();
      syncControlsObserver();
      tick();
    }
  }

  /**
   * 설정만 업데이트 (자막 유지, 즉시 반영)
   */
  function updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    const overlay = document.getElementById(OVERLAY_ID);
    const text    = document.getElementById(TEXT_ID);
    if (overlay && text) applyStyles(overlay, text);

    // overlayPosition 변경 시 옵저버 재설정
    if ('overlayPosition' in newSettings) {
      syncControlsObserver();
    }
  }

  /**
   * 자막 및 오버레이 제거
   */
  function clear() {
    cues                = [];
    videoEl             = null;
    hasExplicitPosition = false;
    controlsVisible     = false;
    stopControlsObserver();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
  }

  return { load, updateSettings, clear };
})();

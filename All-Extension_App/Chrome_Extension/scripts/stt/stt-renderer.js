/**
 * LST - STT Subtitle Renderer
 *
 * 커뮤니티 자막(SubtitleRenderer)과 동일한 스타일 시스템을 사용하는
 * STT 전용 렌더러. 두 개의 독립 패널을 관리한다.
 *   #lst-stt-original  — 상단: 원어
 *   #lst-stt-translated — 하단: 번역
 *
 * [재생바 자동 회피]
 *   하단 패널은 ytp-autohide 클래스 변화를 감지해 bottom 위치를 동적으로 조정.
 */

const SttRenderer = (() => {
  'use strict';

  const TOP_ID    = 'lst-stt-original';
  const BOTTOM_ID = 'lst-stt-translated';

  // ─── 스타일 맵 (subtitle-renderer.js 와 동일) ──────────────

  const SIZE_MAP = {
    '50': '13px', '75': '20px', '100': '26px',
    '150': '39px', '200': '52px', '300': '72px', '400': '96px',
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
    white: '#ffffff', yellow: '#ffff00', green:   '#00ff00',
    cyan:  '#00ffff', blue:   '#0000ff', magenta: '#ff00ff',
    red:   '#ff0000', black:  '#000000',
  };

  const EDGE_STYLE_MAP = {
    none:          'none',
    raised:        '1px 1px 0 #000, 1px 0 0 #000, 0 1px 0 #000',
    depressed:     '-1px -1px 0 #888, 0 -1px 0 #888, -1px 0 0 #888',
    uniform:       '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000',
    'drop-shadow': '2px 2px 3px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.9)',
  };

  let settings        = {};
  let settingsReady   = false;
  let controlsObs     = null;
  let controlsVisible = false;
  let lastCompletedAt = 0;

  // ─── 헬퍼 ─────────────────────────────────────────────────

  function toRgba(colorKey, opacityStr) {
    const hex   = COLOR_MAP[colorKey] || '#000000';
    const r     = parseInt(hex.slice(1, 3), 16);
    const g     = parseInt(hex.slice(3, 5), 16);
    const b     = parseInt(hex.slice(5, 7), 16);
    const alpha = parseInt(opacityStr ?? '100', 10) / 100;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function getPlayer() {
    return document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  }

  function getBottomValue() {
    if (controlsVisible) {
      const bar = document.querySelector('.ytp-chrome-bottom');
      return `${(bar ? bar.offsetHeight : 48) + 24}px`;
    }
    return '2%';
  }

  // ─── 재생바 자동 회피 ──────────────────────────────────────

  function startControlsObserver() {
    if (controlsObs) return;
    const player = getPlayer();
    if (!player) return;

    controlsVisible = !player.classList.contains('ytp-autohide');

    controlsObs = new MutationObserver(() => {
      const nowVisible = !player.classList.contains('ytp-autohide');
      if (nowVisible === controlsVisible) return;
      controlsVisible = nowVisible;
      const bottom = document.getElementById(BOTTOM_ID);
      if (bottom && bottom.style.display !== 'none') {
        bottom.style.bottom = getBottomValue();
      }
    });

    controlsObs.observe(player, { attributes: true, attributeFilter: ['class'] });
  }

  function stopControlsObserver() {
    controlsObs?.disconnect();
    controlsObs     = null;
    controlsVisible = false;
  }

  // ─── 설정 로드 (첫 show() 호출 시 1회) ────────────────────

  function ensureSettings(cb) {
    if (settingsReady) { cb(); return; }
    chrome.storage.sync.get([
      'overlaySize', 'fontFamily',
      'fontColor', 'fontOpacity',
      'bgColor', 'bgOpacity',
      'windowColor', 'windowOpacity',
      'edgeStyle', 'sttMinDisplayMs',
    ], (s) => {
      settings      = s || {};
      settingsReady = true;
      cb();
    });
  }

  // ─── 패널 DOM ─────────────────────────────────────────────

  function getOrCreatePanel(id, vPos) {
    let wrapper = document.getElementById(id);
    if (wrapper) return wrapper;

    const container = getPlayer();
    if (!container) return null;

    // 외부 래퍼: 전체 너비 flex 컨테이너 (창 배경용)
    wrapper = document.createElement('div');
    wrapper.id = id;
    Object.assign(wrapper.style, {
      position:       'absolute',
      left:           '0',
      right:          '0',
      display:        'none',
      justifyContent: 'center',
      padding:        '0 48px',
      pointerEvents:  'none',
      zIndex:         '100',
    });
    wrapper.style[vPos] = vPos === 'bottom' ? getBottomValue() : '2%';

    // 내부 텍스트 박스 (배경·폰트 스타일 적용 대상)
    const text = document.createElement('div');
    text.className = 'lst-stt-text';
    Object.assign(text.style, {
      padding:    '6px 16px',
      borderRadius: '4px',
      lineHeight: '1.5',
      textAlign:  'center',
      maxWidth:   '80%',
      whiteSpace: 'pre-line',
      wordBreak:  'keep-all',
      transition: 'color 0.15s ease, background 0.15s ease',
    });

    wrapper.appendChild(text);
    container.appendChild(wrapper);
    return wrapper;
  }

  function applyStyle(wrapper, isInterim) {
    const s   = settings;
    const fam = s.fontFamily || 'proportional-sans-serif';
    const text = wrapper.querySelector('.lst-stt-text');
    if (!text) return;

    wrapper.style.background = toRgba(s.windowColor || 'black', s.windowOpacity ?? '0');

    text.style.fontSize    = SIZE_MAP[s.overlaySize || '100'] || '26px';
    text.style.fontFamily  = FONT_FAMILY_MAP[fam] || FONT_FAMILY_MAP['proportional-sans-serif'];
    text.style.fontVariant = fam === 'small-caps' ? 'small-caps' : '';
    text.style.color       = toRgba(s.fontColor || 'white', isInterim ? '55' : (s.fontOpacity ?? '100'));
    text.style.textShadow  = EDGE_STYLE_MAP[s.edgeStyle || 'drop-shadow'] || '';
    text.style.background  = toRgba(s.bgColor || 'black', s.bgOpacity ?? '75');
  }

  // ─── 공개 API ─────────────────────────────────────────────

  /**
   * 설정 즉시 반영 (팝업/패널에서 설정 변경 시 호출됨)
   * SubtitleRenderer.updateSettings() 와 동일한 역할
   * @param {object} newSettings - 변경된 설정 키/값 (부분 업데이트 가능)
   */
  function updateSettings(newSettings) {
    Object.assign(settings, newSettings);
    settingsReady = true;

    const top    = document.getElementById(TOP_ID);
    const bottom = document.getElementById(BOTTOM_ID);
    if (top    && top.style.display    !== 'none') applyStyle(top,    false);
    if (bottom && bottom.style.display !== 'none') applyStyle(bottom, false);
  }

  /**
   * STT 자막 표시
   * @param {string}      original   - 원어 (상단 패널)
   * @param {string|null} translated - 번역 (하단 패널); null 또는 원어와 동일하면 하단 숨김
   * @param {boolean}     isInterim  - 중간 결과 여부 → 원어 반투명 표시
   */
  function show(original, translated, isInterim) {
    if (!original?.trim()) return;

    // completed 자막 표시 후 sttMinDisplayMs 동안 interim 업데이트 차단
    const minMs = parseInt(settings.sttMinDisplayMs, 10) || 4000;
    if (isInterim && Date.now() - lastCompletedAt < minMs) return;

    ensureSettings(() => {
      if (!isInterim) lastCompletedAt = Date.now();

      // 상단: 원어
      const top = getOrCreatePanel(TOP_ID, 'top');
      if (top) {
        top.querySelector('.lst-stt-text').textContent = original;
        applyStyle(top, !!isInterim);
        top.style.display = 'flex';
      }

      // 하단: 번역 (원어와 다를 때만 표시)
      const bottom = getOrCreatePanel(BOTTOM_ID, 'bottom');
      if (bottom) {
        const hasTranslation = translated?.trim() && translated.trim() !== original.trim();
        if (hasTranslation) {
          bottom.querySelector('.lst-stt-text').textContent = translated;
          applyStyle(bottom, false);
          bottom.style.bottom  = getBottomValue();
          bottom.style.display = 'flex';
          startControlsObserver();
        } else {
          bottom.style.display = 'none';
        }
      }
    });
  }

  /** STT 자막 패널 제거 및 상태 초기화 */
  function clear() {
    document.getElementById(TOP_ID)?.remove();
    document.getElementById(BOTTOM_ID)?.remove();
    stopControlsObserver();
    settings        = {};
    settingsReady   = false;
    lastCompletedAt = 0;
  }

  return { show, clear, updateSettings };
})();

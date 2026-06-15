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
  const FOCUS_ID  = 'lst-stt-focus-overlay';
  const FOCUS_RECT_STORAGE_KEY = 'lstFocusOverlayRect';
  const FOCUS_HISTORY_LIMIT = 80;
  const FOCUS_IDLE_MS = 2500;

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
  let focusLastTranslated = '';
  let focusHistory    = [];
  let focusInterim    = null;
  let focusIdleTimer  = null;
  let focusRect       = null;
  let focusRectLoaded = false;

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

  function isFocusMode() {
    return (settings.overlayDisplayMode || 'split') === 'focus';
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
      'edgeStyle', 'textAlign', 'sttMinDisplayMs',
      'showOriginal', 'overlayDisplayMode',
    ], (s) => {
      settings      = s || {};
      settingsReady = true;
      cb();
    });
  }

  function loadFocusRect(cb) {
    if (focusRectLoaded) {
      cb(focusRect);
      return;
    }
    chrome.storage.local.get([FOCUS_RECT_STORAGE_KEY], (result) => {
      focusRect = result?.[FOCUS_RECT_STORAGE_KEY] || null;
      focusRectLoaded = true;
      cb(focusRect);
    });
  }

  function saveFocusRect(rect) {
    focusRect = rect;
    chrome.storage.local.set({ [FOCUS_RECT_STORAGE_KEY]: rect });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function numberOr(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function defaultFocusRect(player) {
    const width = Math.max(320, player.clientWidth - 12);
    const height = clamp(Math.round(player.clientHeight * 0.38), 150, Math.max(150, player.clientHeight - 24));
    return {
      left: 6,
      top: 6,
      width,
      height,
    };
  }

  function normalizeFocusRect(rect, player) {
    const fallback = defaultFocusRect(player);
    const minWidth = Math.min(320, player.clientWidth);
    const minHeight = Math.min(140, player.clientHeight);
    const width = clamp(numberOr(rect?.width, fallback.width), minWidth, Math.max(minWidth, player.clientWidth));
    const height = clamp(numberOr(rect?.height, fallback.height), minHeight, Math.max(minHeight, player.clientHeight));
    return {
      left: clamp(numberOr(rect?.left, fallback.left), 0, Math.max(0, player.clientWidth - width)),
      top: clamp(numberOr(rect?.top, fallback.top), 0, Math.max(0, player.clientHeight - height)),
      width,
      height,
    };
  }

  function applyFocusRect(panel, rect) {
    Object.assign(panel.style, {
      left: `${Math.round(rect.left)}px`,
      top: `${Math.round(rect.top)}px`,
      width: `${Math.round(rect.width)}px`,
      height: `${Math.round(rect.height)}px`,
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

  function getOrCreateFocusPanel() {
    let panel = document.getElementById(FOCUS_ID);
    if (panel) return panel;

    const container = getPlayer();
    if (!container) return null;

    panel = document.createElement('div');
    panel.id = FOCUS_ID;
    Object.assign(panel.style, {
      position: 'absolute',
      display: 'none',
      flexDirection: 'column',
      pointerEvents: 'auto',
      zIndex: '101',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.58)',
      boxSizing: 'border-box',
      backdropFilter: 'blur(1.5px)',
      WebkitBackdropFilter: 'blur(1.5px)',
      color: '#fff',
      userSelect: 'text',
    });

    panel.innerHTML = `
      <div class="lst-stt-focus-toolbar" style="
        position:absolute;left:0;right:0;top:0;height:28px;z-index:2;
        display:flex;align-items:center;justify-content:center;
        transition:opacity .18s ease;
      ">
        <div class="lst-stt-focus-drag" title="오버레이 이동" style="
          width:150px;height:5px;border-radius:999px;cursor:move;
          background:rgba(255,255,255,.72);box-shadow:0 1px 2px rgba(0,0,0,.35);
        "></div>
        <button type="button" class="lst-stt-focus-close" title="닫기" style="
          position:absolute;right:7px;top:4px;width:22px;height:22px;
          border:0;background:rgba(0,0,0,.35);color:#fff;font-size:18px;
          line-height:20px;cursor:pointer;padding:0;
        ">×</button>
      </div>
      <div class="lst-stt-focus-current" style="
        flex:0 0 auto;min-height:42px;max-height:44%;overflow-y:auto;overscroll-behavior:contain;
        padding:34px 28px 12px;box-sizing:border-box;
        scrollbar-width:thin;
      "></div>
      <div class="lst-stt-focus-history" style="
        flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;
        padding:8px 28px 22px;box-sizing:border-box;
        border-top:1px solid rgba(255,255,255,.16);
        scrollbar-width:thin;
      "></div>
      <div class="lst-stt-focus-resize" title="창 크기 조정" style="
        position:absolute;right:0;bottom:0;width:18px;height:18px;z-index:3;
        cursor:nwse-resize;
        background:linear-gradient(135deg, transparent 0 45%, rgba(255,255,255,.75) 46% 52%, transparent 53% 62%, rgba(255,255,255,.75) 63% 70%, transparent 71%);
      "></div>
    `;

    bindFocusInteractions(panel, container);
    applyFocusRect(panel, defaultFocusRect(container));
    container.appendChild(panel);

    loadFocusRect((savedRect) => {
      if (!document.body.contains(panel)) return;
      applyFocusRect(panel, normalizeFocusRect(savedRect, container));
    });

    return panel;
  }

  function bindFocusInteractions(panel, container) {
    const drag = panel.querySelector('.lst-stt-focus-drag');
    const resize = panel.querySelector('.lst-stt-focus-resize');
    const close = panel.querySelector('.lst-stt-focus-close');

    const showControls = () => {
      panel.classList.remove('lst-stt-focus-idle');
      const toolbar = panel.querySelector('.lst-stt-focus-toolbar');
      if (toolbar) toolbar.style.opacity = '1';
      clearTimeout(focusIdleTimer);
      focusIdleTimer = setTimeout(() => {
        panel.classList.add('lst-stt-focus-idle');
        const nextToolbar = panel.querySelector('.lst-stt-focus-toolbar');
        if (nextToolbar) nextToolbar.style.opacity = '0';
      }, FOCUS_IDLE_MS);
    };

    panel.addEventListener('mousemove', showControls);
    panel.addEventListener('pointerdown', showControls);
    panel.addEventListener('wheel', showControls, { passive: true });
    close?.addEventListener('click', stopSttFromOverlay);

    drag?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      drag.setPointerCapture?.(event.pointerId);
      const startRect = panel.getBoundingClientRect();
      const playerRect = container.getBoundingClientRect();
      const start = {
        x: event.clientX,
        y: event.clientY,
        left: startRect.left - playerRect.left,
        top: startRect.top - playerRect.top,
        width: startRect.width,
        height: startRect.height,
      };

      const onMove = (moveEvent) => {
        const next = normalizeFocusRect({
          left: start.left + (moveEvent.clientX - start.x),
          top: start.top + (moveEvent.clientY - start.y),
          width: start.width,
          height: start.height,
        }, container);
        applyFocusRect(panel, next);
        focusRect = next;
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (focusRect) saveFocusRect(focusRect);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp, { once: true });
    });

    resize?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      resize.setPointerCapture?.(event.pointerId);
      const startRect = panel.getBoundingClientRect();
      const playerRect = container.getBoundingClientRect();
      const start = {
        x: event.clientX,
        y: event.clientY,
        left: startRect.left - playerRect.left,
        top: startRect.top - playerRect.top,
        width: startRect.width,
        height: startRect.height,
      };

      const onMove = (moveEvent) => {
        const next = normalizeFocusRect({
          left: start.left,
          top: start.top,
          width: start.width + (moveEvent.clientX - start.x),
          height: start.height + (moveEvent.clientY - start.y),
        }, container);
        applyFocusRect(panel, next);
        focusRect = next;
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (focusRect) saveFocusRect(focusRect);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp, { once: true });
    });

    showControls();
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
    text.style.textAlign   = s.textAlign || 'center';
    text.style.background  = toRgba(s.bgColor || 'black', s.bgOpacity ?? '75');
  }

  function applyFocusStyle(panel) {
    const s = settings;
    const current = panel.querySelector('.lst-stt-focus-current');
    const history = panel.querySelector('.lst-stt-focus-history');
    const family = s.fontFamily || 'proportional-sans-serif';
    const align = s.textAlign || 'center';
    const opacity = s.windowOpacity === undefined || s.windowOpacity === '0'
      ? '65'
      : s.windowOpacity;

    panel.style.background = toRgba(s.windowColor || 'black', opacity);

    [current, history].forEach((area) => {
      if (!area) return;
      area.style.fontFamily = FONT_FAMILY_MAP[family] || FONT_FAMILY_MAP['proportional-sans-serif'];
      area.style.fontVariant = family === 'small-caps' ? 'small-caps' : '';
      area.style.textAlign = align;
    });
  }

  function setPanelText(wrapper, value) {
    const text = wrapper.querySelector('.lst-stt-text');
    if (!text) return;
    text.textContent = value;
  }

  function removeSplitPanels() {
    document.getElementById(TOP_ID)?.remove();
    document.getElementById(BOTTOM_ID)?.remove();
    stopControlsObserver();
  }

  function removeFocusPanel() {
    document.getElementById(FOCUS_ID)?.remove();
    clearTimeout(focusIdleTimer);
    focusIdleTimer = null;
  }

  function stopSttFromOverlay() {
    chrome.runtime.sendMessage({ action: 'stopSttForCurrentTab' }).catch(() => {});
    clear();
  }

  function appendFocusFinal(original, translated) {
    const normalized = {
      original: original.trim(),
      translated: translated?.trim() || '',
      at: Date.now(),
    };
    if (normalized.translated) focusLastTranslated = normalized.translated;
    const latest = focusHistory[0];
    if (
      latest &&
      latest.original === normalized.original &&
      latest.translated === normalized.translated
    ) {
      latest.at = normalized.at;
      return;
    }
    focusHistory.unshift(normalized);
    if (focusHistory.length > FOCUS_HISTORY_LIMIT) {
      focusHistory = focusHistory.slice(0, FOCUS_HISTORY_LIMIT);
    }
  }

  function getFocusFontSize(isHistory) {
    const scale = isHistory ? 0.62 : 0.78;
    const maxSize = isHistory ? 24 : 34;
    const baseSize = SIZE_MAP[settings.overlaySize || '100'] || '26px';
    const base = parseFloat(baseSize);
    return `${clamp(Math.round(base * scale), 12, maxSize)}px`;
  }

  function createFocusEntry(item, isInterim, isHistory = false, fallbackTranslated = '') {
    const s = settings;
    const displayTranslated = item.translated || fallbackTranslated;
    const showOriginal = s.showOriginal !== false || !displayTranslated;
    const fontSize = getFocusFontSize(isHistory);
    const fontColor = isHistory
      ? 'rgba(224,230,232,0.66)'
      : toRgba(s.fontColor || 'white', isInterim ? '70' : (s.fontOpacity ?? '100'));
    const shadow = EDGE_STYLE_MAP[s.edgeStyle || 'drop-shadow'] || '';
    const entry = document.createElement('div');
    entry.className = isInterim ? 'lst-stt-focus-entry lst-stt-focus-entry--interim' : 'lst-stt-focus-entry';
    Object.assign(entry.style, {
      padding: isHistory ? '6px 0' : '8px 0',
      borderBottom: isHistory ? '1px dashed rgba(255,255,255,.12)' : '0',
      opacity: isHistory ? '0.88' : '1',
    });

    if (showOriginal) {
      const original = document.createElement('div');
      original.className = 'lst-stt-focus-original';
      original.textContent = item.original;
      Object.assign(original.style, {
        color: isHistory ? 'rgba(200,208,210,0.48)' : toRgba(s.fontColor || 'white', isInterim ? '58' : '78'),
        fontSize: `calc(${fontSize} * .7)`,
        lineHeight: '1.35',
        textShadow: shadow,
        wordBreak: 'keep-all',
        overflowWrap: 'anywhere',
      });
      entry.appendChild(original);
    }

    if (displayTranslated) {
      const main = document.createElement('div');
      main.className = 'lst-stt-focus-translated';
      main.textContent = displayTranslated;
      Object.assign(main.style, {
        color: fontColor,
        fontSize,
        fontWeight: isHistory ? '500' : '600',
        lineHeight: '1.45',
        textShadow: shadow,
        wordBreak: 'keep-all',
        overflowWrap: 'anywhere',
      });
      entry.appendChild(main);
    }

    return entry;
  }

  function renderFocusPanel(panel) {
    const current = panel.querySelector('.lst-stt-focus-current');
    const history = panel.querySelector('.lst-stt-focus-history');
    if (!current || !history) return;

    const currentScrollTop = current.scrollTop;
    const historyNearTop = history.scrollTop < 48;
    const historyScrollTop = history.scrollTop;
    const historyScrollHeight = history.scrollHeight;

    current.textContent = '';
    history.textContent = '';

    if (focusInterim) {
      const fallbackTranslated = focusInterim.translated ? '' : focusLastTranslated;
      current.appendChild(createFocusEntry(focusInterim, true, false, fallbackTranslated));
    }
    current.scrollTop = currentScrollTop;

    focusHistory.forEach(item => history.appendChild(createFocusEntry(item, false, true)));

    if (historyNearTop) {
      history.scrollTop = 0;
    } else {
      history.scrollTop = historyScrollTop + (history.scrollHeight - historyScrollHeight);
    }
  }

  function showFocus(original, translated, isInterim) {
    removeSplitPanels();

    const panel = getOrCreateFocusPanel();
    if (!panel) return;

    applyFocusStyle(panel);
    panel.style.display = 'flex';

    if (isInterim) {
      if (translated?.trim()) focusLastTranslated = translated.trim();
      focusInterim = {
        original: original.trim(),
        translated: translated?.trim() || '',
      };
    } else {
      focusInterim = null;
      appendFocusFinal(original, translated);
    }

    renderFocusPanel(panel);

    const toolbar = panel.querySelector('.lst-stt-focus-toolbar');
    if (toolbar) toolbar.style.opacity = '1';
    clearTimeout(focusIdleTimer);
    focusIdleTimer = setTimeout(() => {
      const nextToolbar = panel.querySelector('.lst-stt-focus-toolbar');
      if (nextToolbar) nextToolbar.style.opacity = '0';
    }, FOCUS_IDLE_MS);
  }

  // ─── 공개 API ─────────────────────────────────────────────

  /**
   * 설정 즉시 반영 (팝업/패널에서 설정 변경 시 호출됨)
   * SubtitleRenderer.updateSettings() 와 동일한 역할
   * @param {object} newSettings - 변경된 설정 키/값 (부분 업데이트 가능)
   */
  function updateSettings(newSettings) {
    const oldMode = settings.overlayDisplayMode || 'split';
    Object.assign(settings, newSettings);
    settingsReady = true;
    const newMode = settings.overlayDisplayMode || 'split';

    if (oldMode !== newMode) {
      if (newMode === 'focus') {
        removeSplitPanels();
      } else {
        removeFocusPanel();
      }
    }

    const top    = document.getElementById(TOP_ID);
    const bottom = document.getElementById(BOTTOM_ID);
    if (top    && top.style.display    !== 'none') applyStyle(top,    false);
    if (bottom && bottom.style.display !== 'none') applyStyle(bottom, false);

    const focus = document.getElementById(FOCUS_ID);
    if (focus) {
      applyFocusStyle(focus);
      renderFocusPanel(focus);
    }
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

      if (isFocusMode()) {
        showFocus(original, translated, isInterim);
        return;
      }

      removeFocusPanel();

      // 상단: 원어
      const top = getOrCreatePanel(TOP_ID, 'top');
      const hasTranslation = translated?.trim() && translated.trim() !== original.trim();
      if (top) {
        if (settings.showOriginal === false && hasTranslation) {
          top.style.display = 'none';
        } else {
          setPanelText(top, original);
          applyStyle(top, !!isInterim);
          top.style.display = 'flex';
        }
      }

      // 하단: 번역 (원어와 다를 때만 표시)
      const bottom = getOrCreatePanel(BOTTOM_ID, 'bottom');
      if (bottom) {
        if (hasTranslation) {
          setPanelText(bottom, translated);
          applyStyle(bottom, !!isInterim);
          bottom.style.bottom  = getBottomValue();
          bottom.style.display = 'flex';
          startControlsObserver();
        } else if (!isInterim) {
          // 최종 결과에 번역 없을 때만 하단 숨김
          // interim + 번역 없음: 이전 번역 그대로 유지 (깜빡임 방지)
          bottom.style.display = 'none';
        }
      }
    });
  }

  /** STT 자막 패널 제거 및 상태 초기화 */
  function clear() {
    removeSplitPanels();
    removeFocusPanel();
    stopControlsObserver();
    settings        = {};
    settingsReady   = false;
    lastCompletedAt = 0;
    focusLastTranslated = '';
    focusHistory    = [];
    focusInterim    = null;
  }

  return { show, clear, updateSettings };
})();

/**
 * LST - Player Panel
 * YouTube 플레이어 내 LST 독립 패널 및 컨트롤바 버튼 주입
 *
 * [뷰 구조]
 * main → (자막 언어)  → lang     (언어 선택 서브패널)
 * main → (⚙ 설정)    → settings (표시 설정 서브패널)
 */

const LSTPanel = (() => {
  const PANEL_ID  = 'lst-panel';
  const BUTTON_ID = 'lst-panel-btn';

  let currentView       = 'main';
  let panelOpen         = false;
  let outsideClickBound = false; // 외부 클릭 리스너 중복 등록 방지

  // ─── 상수 ────────────────────────────────────────────────

  const LANG_NAMES = {
    'ko':'한국어','en':'English','ja':'日本語',
    'zh-CN':'中文 (简体)','zh-TW':'中文 (繁體)',
    'es':'Español','fr':'Français','de':'Deutsch','ru':'Русский',
  };

  const FONT_FAMILY_OPTIONS = [
    { value: 'proportional-sans-serif', label: '고정폭 없는 산세리프' },
    { value: 'proportional-serif',      label: '고정폭 없는 세리프' },
    { value: 'monospace-serif',         label: '고정폭 세리프' },
    { value: 'monospace-sans-serif',    label: '고정폭 산세리프' },
    { value: 'casual',                  label: '캐주얼' },
    { value: 'cursive',                 label: '필기체' },
    { value: 'small-caps',             label: '소문자 대문자' },
  ];

  const COLOR_OPTIONS = [
    { value: 'white',   label: '흰색' },
    { value: 'yellow',  label: '노란색' },
    { value: 'green',   label: '녹색' },
    { value: 'cyan',    label: '청록색' },
    { value: 'blue',    label: '파란색' },
    { value: 'magenta', label: '자홍색' },
    { value: 'red',     label: '빨간색' },
    { value: 'black',   label: '검정색' },
  ];

  const EDGE_STYLE_OPTIONS = [
    { value: 'none',        label: '없음' },
    { value: 'raised',      label: '볼록' },
    { value: 'depressed',   label: '오목' },
    { value: 'uniform',     label: '균일' },
    { value: 'drop-shadow', label: '그림자 효과' },
  ];

  const SIZE_STEPS    = ['50','75','100','150','200','300','400'];
  const OPACITY_STEPS = ['0','25','50','75','100'];

  const SILENCE_OPTIONS = [
    { value: '500',  label: '0.5초' },
    { value: '1000', label: '1초' },
    { value: '1500', label: '1.5초' },
    { value: '2000', label: '2초' },
    { value: '3000', label: '3초' },
  ];
  const MIN_DISPLAY_OPTIONS = [
    { value: '2000', label: '2초' },
    { value: '3000', label: '3초' },
    { value: '4000', label: '4초' },
    { value: '5000', label: '5초' },
    { value: '6000', label: '6초' },
  ];

  const DISPLAY_DEFAULTS = {
    fontFamily:    'proportional-sans-serif',
    fontColor:     'white',
    fontOpacity:   '100',
    overlaySize:   '100',
    edgeStyle:     'drop-shadow',
    bgColor:       'black',
    bgOpacity:     '75',
    windowColor:   'black',
    windowOpacity: '0',
  };

  // ─── 상태 ────────────────────────────────────────────────

  let state = {
    enabled:      true,
    lang:         'auto',
    languages:    [],
    info:         null,
    // 표시 설정
    ...DISPLAY_DEFAULTS,
    // 실시간 STT 설정
    sttEngine:       'whisper',
    whisperModel:    'gpt-4o-mini-transcribe',
    realtimeModel:   'gpt-realtime-whisper',
    sttSilenceMs:    1500,
    sttMinDisplayMs: 4000,
    // 콜백
    onToggle:        null,
    onLangChange:    null,
    onSettingChange: null,
  };

  // ─── 유틸 ────────────────────────────────────────────────

  function langName(code) { return LANG_NAMES[code] || code; }

  function sizeToIndex(val) {
    const i = SIZE_STEPS.indexOf(val);
    return i >= 0 ? i : 2;
  }
  function opacityToIndex(val) {
    const i = OPACITY_STEPS.indexOf(String(val));
    return i >= 0 ? i : 0;
  }

  function buildOptions(options, selectedValue) {
    return options.map(o =>
      `<option value="${o.value}"${o.value === selectedValue ? ' selected' : ''}>${o.label}</option>`
    ).join('');
  }

  // ─── DOM 헬퍼 ────────────────────────────────────────────

  function getPlayerContainer() {
    return document.querySelector('#movie_player') ||
           document.querySelector('.html5-video-player');
  }

  const SVG_CHEVRON = `
    <svg class="lst-panel-chevron" viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2l5 6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  // ─── 패널 생성 ───────────────────────────────────────────

  function createPanel() {
    const el = document.createElement('div');
    el.id = PANEL_ID;
    el.className = 'lst-panel lst-hidden';

    el.innerHTML = `
      <!-- ── 메인 뷰 ── -->
      <div class="lst-view" id="lst-view-main">
        <div class="lst-panel-header">
          <span class="lst-panel-title">LST Project for Extension</span>
        </div>
        <div class="lst-panel-row">
          <span class="lst-panel-label">커뮤니티 자막 사용</span>
          <label class="lst-toggle">
            <input type="checkbox" id="lst-toggle-chk">
            <span class="lst-toggle-track"></span>
          </label>
        </div>
        <div class="lst-panel-divider"></div>
        <div class="lst-panel-row lst-panel-row--btn" id="lst-lang-row">
          <span class="lst-panel-label">자막 언어</span>
          <div class="lst-panel-row-right">
            <span class="lst-panel-meta" id="lst-lang-value">—</span>
            ${SVG_CHEVRON}
          </div>
        </div>
        <div class="lst-panel-row lst-panel-row--btn" id="lst-settings-row">
          <span class="lst-panel-label">⚙ 설정</span>
          <div class="lst-panel-row-right">
            ${SVG_CHEVRON}
          </div>
        </div>
        <div class="lst-panel-divider"></div>
        <div class="lst-panel-section">
          <p class="lst-panel-section-title">자막 정보</p>
          <div id="lst-info-body"></div>
        </div>
      </div>

      <!-- ── 언어 선택 서브패널 ── -->
      <div class="lst-view lst-hidden" id="lst-view-lang">
        <div class="lst-panel-header lst-panel-header--sub">
          <button class="lst-back-btn" data-back="main">&#8249;</button>
          <span class="lst-panel-subtitle">자막 언어</span>
        </div>
        <div id="lst-lang-list" class="lst-lang-list"></div>
      </div>

      <!-- ── 설정 서브패널 ── -->
      <div class="lst-view lst-hidden" id="lst-view-settings">
        <div class="lst-panel-header lst-panel-header--sub">
          <button class="lst-back-btn" data-back="main">&#8249;</button>
          <span class="lst-panel-subtitle">설정</span>
        </div>
        <div class="lst-settings-body" id="lst-settings-body"></div>
      </div>
    `;

    // 이벤트 바인딩
    el.querySelector('#lst-toggle-chk').addEventListener('change', (e) => {
      state.enabled = e.target.checked;
      updateBtnEnabled();
      if (state.onToggle) state.onToggle(state.enabled);
    });

    el.querySelector('#lst-lang-row').addEventListener('click', () => {
      if (state.languages.length === 0) return;
      showView('lang');
    });

    el.querySelector('#lst-settings-row').addEventListener('click', () => {
      showView('settings');
    });

    el.querySelectorAll('.lst-back-btn').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.back || 'main'));
    });

    el.addEventListener('click', e => e.stopPropagation());
    return el;
  }

  function getOrCreatePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) return existing;
    const container = getPlayerContainer();
    if (!container) return null;
    const el = createPanel();
    container.appendChild(el);
    return el;
  }

  // ─── 뷰 전환 ────────────────────────────────────────────

  function showView(viewName) {
    ['main','lang','settings'].forEach(name => {
      const el = document.getElementById(`lst-view-${name}`);
      if (el) el.classList.toggle('lst-hidden', name !== viewName);
    });
    currentView = viewName;

    if (viewName === 'lang')     renderLangList();
    if (viewName === 'settings') renderSettings();
  }

  // ─── 언어 목록 ──────────────────────────────────────────

  function renderLangList() {
    const list = document.getElementById('lst-lang-list');
    if (!list) return;
    list.innerHTML = '';

    if (state.languages.length === 0) {
      list.innerHTML = '<div class="lst-lang-empty">사용 가능한 자막 없음</div>';
      return;
    }

    state.languages.forEach(code => {
      const item = document.createElement('div');
      item.className = 'lst-lang-item' + (code === state.lang ? ' lst-lang-item--active' : '');
      item.textContent = langName(code);
      item.addEventListener('click', () => {
        state.lang = code;
        if (state.onLangChange) state.onLangChange(code);
        updateLangValue();
        showView('main');
      });
      list.appendChild(item);
    });
  }

  function updateLangValue() {
    const el  = document.getElementById('lst-lang-value');
    const row = document.getElementById('lst-lang-row');
    if (!el) return;

    const hasLangs = state.languages.length > 0;

    // 자막 데이터 없으면 행 비활성화
    if (row) row.classList.toggle('lst-panel-row--disabled', !hasLangs);

    // 현재 영상에 자막 없으면 이전 설정 언어와 무관하게 '—' 표시
    if (!hasLangs) {
      el.textContent = '—';
      return;
    }

    el.textContent = (!state.lang || state.lang === 'auto')
      ? '자동' : langName(state.lang);
  }

  // ─── 설정 서브패널 ───────────────────────────────────────

  function renderSettings() {
    const body = document.getElementById('lst-settings-body');
    if (!body) return;

    body.innerHTML = `
      <!-- 탭 헤더 -->
      <div class="lst-settings-tabs">
        <button class="lst-settings-tab lst-settings-tab--active" data-tab="common">공통</button>
        <button class="lst-settings-tab" data-tab="realtime">실시간</button>
      </div>

      <!-- 공통 탭 -->
      <div class="lst-settings-tab-body" id="lst-tab-common">
        <div class="lst-setting-group">
          <div class="lst-setting-item">
            <span class="lst-setting-label">글꼴 모음</span>
            <select class="lst-setting-select" id="lst-set-fontFamily">
              ${buildOptions(FONT_FAMILY_OPTIONS, state.fontFamily)}
            </select>
          </div>
          <div class="lst-setting-item">
            <span class="lst-setting-label">글꼴 색상</span>
            <select class="lst-setting-select" id="lst-set-fontColor">
              ${buildOptions(COLOR_OPTIONS, state.fontColor)}
            </select>
          </div>
          <div class="lst-setting-item">
            <div class="lst-setting-row-top">
              <span class="lst-setting-label">글꼴 불투명도</span>
              <span class="lst-setting-val" id="lst-set-fontOpacity-val">${state.fontOpacity}%</span>
            </div>
            <input type="range" class="lst-setting-range" id="lst-set-fontOpacity"
              min="0" max="4" step="1" value="${opacityToIndex(state.fontOpacity)}">
          </div>
          <div class="lst-setting-item">
            <div class="lst-setting-row-top">
              <span class="lst-setting-label">글꼴 크기</span>
              <span class="lst-setting-val" id="lst-set-overlaySize-val">${state.overlaySize}%</span>
            </div>
            <input type="range" class="lst-setting-range" id="lst-set-overlaySize"
              min="0" max="6" step="1" value="${sizeToIndex(state.overlaySize)}">
          </div>
          <div class="lst-setting-item">
            <span class="lst-setting-label">글자 테두리</span>
            <select class="lst-setting-select" id="lst-set-edgeStyle">
              ${buildOptions(EDGE_STYLE_OPTIONS, state.edgeStyle)}
            </select>
          </div>
        </div>
        <div class="lst-panel-divider"></div>
        <div class="lst-setting-group">
          <div class="lst-setting-item">
            <span class="lst-setting-label">배경 색상</span>
            <select class="lst-setting-select" id="lst-set-bgColor">
              ${buildOptions(COLOR_OPTIONS, state.bgColor)}
            </select>
          </div>
          <div class="lst-setting-item">
            <div class="lst-setting-row-top">
              <span class="lst-setting-label">배경 불투명도</span>
              <span class="lst-setting-val" id="lst-set-bgOpacity-val">${state.bgOpacity}%</span>
            </div>
            <input type="range" class="lst-setting-range" id="lst-set-bgOpacity"
              min="0" max="4" step="1" value="${opacityToIndex(state.bgOpacity)}">
          </div>
        </div>
        <div class="lst-panel-divider"></div>
        <div class="lst-setting-group">
          <div class="lst-setting-item">
            <span class="lst-setting-label">창 색상</span>
            <select class="lst-setting-select" id="lst-set-windowColor">
              ${buildOptions(COLOR_OPTIONS, state.windowColor)}
            </select>
          </div>
          <div class="lst-setting-item">
            <div class="lst-setting-row-top">
              <span class="lst-setting-label">창 불투명도</span>
              <span class="lst-setting-val" id="lst-set-windowOpacity-val">${state.windowOpacity}%</span>
            </div>
            <input type="range" class="lst-setting-range" id="lst-set-windowOpacity"
              min="0" max="4" step="1" value="${opacityToIndex(state.windowOpacity)}">
          </div>
        </div>
        <div class="lst-panel-divider"></div>
        <div class="lst-setting-group">
          <button class="lst-reset-btn" id="lst-set-reset">재설정</button>
        </div>
      </div>

      <!-- 실시간 탭 -->
      <div class="lst-settings-tab-body lst-hidden" id="lst-tab-realtime">
        ${state.sttEngine === 'realtime' ? `
        <div class="lst-setting-group">
          <div class="lst-setting-item">
            <span class="lst-setting-label">Realtime 모델</span>
            <select class="lst-setting-select" id="lst-set-realtimeModel">
              <option value="gpt-realtime-whisper"${state.realtimeModel === 'gpt-realtime-whisper' ? ' selected' : ''}>gpt-realtime-whisper (전사 전용)</option>
              <option value="gpt-realtime"${state.realtimeModel === 'gpt-realtime' ? ' selected' : ''}>gpt-realtime</option>
              <option value="gpt-realtime-mini"${state.realtimeModel === 'gpt-realtime-mini' ? ' selected' : ''}>gpt-realtime-mini</option>
              <option value="gpt-realtime-translate"${state.realtimeModel === 'gpt-realtime-translate' ? ' selected' : ''}>gpt-realtime-translate (음성 번역)</option>
            </select>
          </div>
          <div class="lst-setting-item">
            <span class="lst-setting-label">침묵 감지 시간</span>
            <select class="lst-setting-select" id="lst-set-sttSilenceMs">
              ${buildOptions(SILENCE_OPTIONS, String(state.sttSilenceMs))}
            </select>
          </div>
          <div class="lst-setting-item">
            <span class="lst-setting-label">최소 표시 시간</span>
            <select class="lst-setting-select" id="lst-set-sttMinDisplayMs">
              ${buildOptions(MIN_DISPLAY_OPTIONS, String(state.sttMinDisplayMs))}
            </select>
          </div>
        </div>
        ` : `
        <div class="lst-setting-group">
          <div class="lst-setting-item">
            <span class="lst-setting-label">Whisper 모델</span>
            <select class="lst-setting-select" id="lst-set-whisperModel">
              <option value="gpt-4o-mini-transcribe"${state.whisperModel === 'gpt-4o-mini-transcribe' ? ' selected' : ''}>gpt-4o-mini-transcribe</option>
              <option value="gpt-4o-transcribe"${state.whisperModel === 'gpt-4o-transcribe' ? ' selected' : ''}>gpt-4o-transcribe</option>
              <option value="whisper-1"${state.whisperModel === 'whisper-1' ? ' selected' : ''}>whisper-1</option>
            </select>
          </div>
          <div class="lst-setting-item">
            <span class="lst-setting-label">최소 표시 시간</span>
            <select class="lst-setting-select" id="lst-set-sttMinDisplayMs">
              ${buildOptions(MIN_DISPLAY_OPTIONS, String(state.sttMinDisplayMs))}
            </select>
          </div>
        </div>
        `}
      </div>
    `;

    // 탭 전환
    body.querySelectorAll('.lst-settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        body.querySelectorAll('.lst-settings-tab').forEach(t => t.classList.remove('lst-settings-tab--active'));
        body.querySelectorAll('.lst-settings-tab-body').forEach(t => t.classList.add('lst-hidden'));
        tab.classList.add('lst-settings-tab--active');
        body.querySelector(`#lst-tab-${tab.dataset.tab}`)?.classList.remove('lst-hidden');
      });
    });

    bindSettingsEvents(body);
  }

  function bindSettingsEvents(body) {
    // select 변경
    const selectMap = {
      'lst-set-fontFamily': 'fontFamily',
      'lst-set-fontColor':  'fontColor',
      'lst-set-edgeStyle':  'edgeStyle',
      'lst-set-bgColor':    'bgColor',
      'lst-set-windowColor':'windowColor',
    };
    Object.entries(selectMap).forEach(([id, key]) => {
      body.querySelector(`#${id}`)?.addEventListener('change', (e) => {
        state[key] = e.target.value;
        dispatchSetting(key, e.target.value);
      });
    });

    // opacity 슬라이더
    const opacityMap = {
      'lst-set-fontOpacity':   'fontOpacity',
      'lst-set-bgOpacity':     'bgOpacity',
      'lst-set-windowOpacity': 'windowOpacity',
    };
    Object.entries(opacityMap).forEach(([id, key]) => {
      body.querySelector(`#${id}`)?.addEventListener('input', (e) => {
        const val = OPACITY_STEPS[parseInt(e.target.value)];
        state[key] = val;
        body.querySelector(`#${id}-val`).textContent = val + '%';
        dispatchSetting(key, val);
      });
    });

    // 실시간 STT select (정수값)
    const sttIntSelectMap = {
      'lst-set-sttSilenceMs':    'sttSilenceMs',
      'lst-set-sttMinDisplayMs': 'sttMinDisplayMs',
    };
    Object.entries(sttIntSelectMap).forEach(([id, key]) => {
      body.querySelector(`#${id}`)?.addEventListener('change', (e) => {
        state[key] = parseInt(e.target.value, 10);
        dispatchSetting(key, parseInt(e.target.value, 10));
      });
    });

    // 실시간 STT select (문자열값 — 모델명)
    const sttStrSelectMap = {
      'lst-set-whisperModel':  'whisperModel',
      'lst-set-realtimeModel': 'realtimeModel',
    };
    Object.entries(sttStrSelectMap).forEach(([id, key]) => {
      body.querySelector(`#${id}`)?.addEventListener('change', (e) => {
        state[key] = e.target.value;
        dispatchSetting(key, e.target.value);
      });
    });

    // size 슬라이더
    body.querySelector('#lst-set-overlaySize')?.addEventListener('input', (e) => {
      const val = SIZE_STEPS[parseInt(e.target.value)];
      state.overlaySize = val;
      body.querySelector('#lst-set-overlaySize-val').textContent = val + '%';
      dispatchSetting('overlaySize', val);
    });

    // 재설정
    body.querySelector('#lst-set-reset')?.addEventListener('click', () => {
      Object.assign(state, DISPLAY_DEFAULTS);
      if (state.onSettingChange) state.onSettingChange({ ...DISPLAY_DEFAULTS });
      renderSettings(); // 폼 재렌더링
    });
  }

  function dispatchSetting(key, value) {
    if (state.onSettingChange) state.onSettingChange({ [key]: value });
  }

  // ─── 자막 정보 ───────────────────────────────────────────

  function renderInfo() {
    const body = document.getElementById('lst-info-body');
    if (!body) return;
    const info = state.info;
    if (!info || !info.format) {
      body.innerHTML = '<span class="lst-info-empty">자막 없음</span>';
      return;
    }
    const rows = [
      ['포맷', info.format.toUpperCase()],
      ['언어 수', `${state.languages.length}개`],
    ];
    if (info.contributor)    rows.push(['기여자', info.contributor]);
    if (info.revisionNumber) rows.push(['리비전', `#${info.revisionNumber}`]);
    body.innerHTML = rows.map(([k,v]) =>
      `<div class="lst-info-row"><span class="lst-info-key">${k}</span><span class="lst-info-val">${v}</span></div>`
    ).join('');
  }

  // ─── 패널 열기/닫기 ──────────────────────────────────────

  function togglePanel() { panelOpen ? closePanel() : openPanel(); }

  function openPanel() {
    const panel = getOrCreatePanel();
    if (!panel) return;

    // YouTube 설정 패널이 열려 있으면 먼저 닫기 (상호 배타)
    const ytMenu = document.querySelector('.ytp-settings-menu');
    const ytBtn  = document.querySelector('.ytp-settings-button');
    if (ytMenu && ytBtn && ytMenu.offsetHeight > 0) {
      ytBtn.click();
    }

    positionPanel(panel);
    panel.classList.remove('lst-hidden');
    panelOpen = true;
    showView('main');
    // 현재 state를 DOM에 반영
    const chk = panel.querySelector('#lst-toggle-chk');
    if (chk) chk.checked = !!state.enabled;
    updateLangValue();
    renderInfo();
    document.getElementById(BUTTON_ID)?.classList.add('lst-btn--active');
  }

  function closePanel() {
    document.getElementById(PANEL_ID)?.classList.add('lst-hidden');
    panelOpen   = false;
    currentView = 'main';
    document.getElementById(BUTTON_ID)?.classList.remove('lst-btn--active');
  }

  function positionPanel(panel) {
    const bar = document.querySelector('.ytp-chrome-bottom');
    panel.style.bottom = `${(bar ? bar.offsetHeight : 48) + 8}px`;
  }

  // ─── 외부 클릭으로 패널 닫기 ────────────────────────────

  /**
   * capture 단계에서 클릭을 감지 → YouTube 이벤트 차단 이전에 실행됨
   * 패널/버튼 내부 클릭은 무시, 외부 클릭만 닫기
   * SPA 전환 후에도 중복 등록되지 않도록 플래그로 보호
   */
  function setupOutsideClick() {
    if (outsideClickBound) return;
    outsideClickBound = true;

    // 크롬 내부 외부 클릭
    document.addEventListener('click', () => { if (panelOpen) closePanel(); });

    // 크롬 밖 클릭 / 다른 앱으로 전환 시 (포커스 이탈)
    window.addEventListener('blur', () => { if (panelOpen) closePanel(); });

    // 다른 탭으로 전환 시
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && panelOpen) closePanel();
    });
  }

  // ─── 버튼 주입 ───────────────────────────────────────────

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const settingsBtn = document.querySelector('.ytp-settings-button');
    if (!settingsBtn?.parentElement) return;

    const btn = document.createElement('button');
    btn.id        = BUTTON_ID;
    btn.className = 'ytp-button lst-panel-btn';
    btn.title     = 'LST 커뮤니티 자막';
    btn.setAttribute('aria-label', 'LST 커뮤니티 자막 패널 열기');
    btn.innerHTML = `<svg viewBox="0 0 36 36" width="100%" height="100%" aria-hidden="true">${ICON_SVG.off}</svg>`;
    updateBtnEnabled();
    btn.addEventListener('click', e => { e.stopPropagation(); togglePanel(); });
    settingsBtn.parentElement.insertBefore(btn, settingsBtn);

    // YouTube 설정 버튼 클릭 시 LST 패널 닫기 (상호 배타)
    settingsBtn.addEventListener('click', () => { if (panelOpen) closePanel(); });

    // 외부 클릭 리스너 (한 번만 등록)
    setupOutsideClick();
  }

  // ─── 공개 API ────────────────────────────────────────────

  const ICON_SVG = {
    // C1 (A4 필름 스트립 스타일) — YouTube 자막 토글 아이콘 박스 기준
    off: `
      <path class="lst-icon-frame" d="M4.5 4.5 H31.5 Q34.5 4.5 34.5 7.5 V28.5 Q34.5 31.5 31.5 31.5 H4.5 Q1.5 31.5 1.5 28.5 V7.5 Q1.5 4.5 4.5 4.5 Z" fill="none" stroke="white" stroke-width="2.2"/>
      <path class="lst-icon-rule" d="M1.5 10.5 H34.5 M1.5 25.5 H34.5 M1.5 10.5 V25.5 M34.5 10.5 V25.5" fill="none" stroke="white" stroke-width="1.4"/>
      <path class="lst-icon-caption" d="M9 20.5 H16.5 M19.5 20.5 H27" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round"/>`,
    on: `
      <path class="lst-icon-frame lst-icon-frame--filled" fill="white" fill-rule="evenodd" d="
        M4.5 4.5 H31.5 Q34.5 4.5 34.5 7.5 V28.5 Q34.5 31.5 31.5 31.5 H4.5 Q1.5 31.5 1.5 28.5 V7.5 Q1.5 4.5 4.5 4.5 Z
        M4.5 9.8 H31.5 V11.2 H4.5 Z
        M4.5 24.8 H31.5 V26.2 H4.5 Z
        M8.2 20.5 Q8.2 19.7 9 19.7 H16.5 Q17.3 19.7 17.3 20.5 Q17.3 21.3 16.5 21.3 H9 Q8.2 21.3 8.2 20.5 Z
        M18.7 20.5 Q18.7 19.7 19.5 19.7 H27 Q27.8 19.7 27.8 20.5 Q27.8 21.3 27 21.3 H19.5 Q18.7 21.3 18.7 20.5 Z"/>`,
  };

  function updateBtnEnabled() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    const enabled = !!state.enabled;
    btn.classList.toggle('lst-btn--on', enabled);
    btn.setAttribute('aria-pressed', String(enabled));
    btn.setAttribute(
      'aria-label',
      enabled ? 'LST 커뮤니티 자막 켜짐. 패널 열기' : 'LST 커뮤니티 자막 꺼짐. 패널 열기'
    );
    const svg = btn.querySelector('svg');
    if (svg) svg.innerHTML = enabled ? ICON_SVG.on : ICON_SVG.off;
  }

  function update(opts) {
    Object.assign(state, opts);
    updateBtnEnabled();
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const chk = panel.querySelector('#lst-toggle-chk');
    if (chk) chk.checked = !!state.enabled;
    updateLangValue();
    renderInfo();
    if (currentView === 'lang')     renderLangList();
    if (currentView === 'settings') renderSettings();
  }

  function destroy() {
    closePanel();
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(BUTTON_ID)?.remove();
    panelOpen = false; currentView = 'main';
  }

  return { injectButton, update, closePanel, destroy };
})();

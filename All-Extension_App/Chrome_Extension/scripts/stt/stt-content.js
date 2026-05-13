/**
 * LST - STT Content Script (Web Speech API)
 * Plain IIFE — ES module 없이 manifest content_scripts에서 직접 로드
 */
(function () {
  'use strict';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('[LST STT] Web Speech API not supported');
    return;
  }

  const LANG_MAP = {
    'ko': 'ko-KR', 'en': 'en-US', 'ja': 'ja-JP',
    'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
    'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'ru': 'ru-RU',
  };

  let recognition    = null;
  let isRecognizing  = false;
  let autoRestart    = false;
  let restartCount   = 0;
  const MAX_RESTART  = 5;
  let overlayEl      = null;
  let subtitleEl     = null;
  let clearTimer     = null;

  /* ─── 오버레이 ─────────────────────────────────────────────── */

  function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'lst-stt-overlay';
    Object.assign(overlayEl.style, {
      position:        'fixed',
      bottom:          '80px',
      left:            '50%',
      transform:       'translateX(-50%)',
      maxWidth:        '80%',
      textAlign:       'center',
      zIndex:          '2147483647',
      pointerEvents:   'none',
      fontFamily:      'Arial, sans-serif',
    });

    subtitleEl = document.createElement('div');
    Object.assign(subtitleEl.style, {
      display:         'inline-block',
      padding:         '6px 16px',
      background:      'rgba(0,0,0,0.78)',
      color:           'white',
      fontSize:        '18px',
      lineHeight:      '1.5',
      borderRadius:    '4px',
      wordBreak:       'keep-all',
      whiteSpace:      'pre-wrap',
    });

    overlayEl.appendChild(subtitleEl);
    document.body.appendChild(overlayEl);
  }

  function removeOverlay() {
    clearTimeout(clearTimer);
    overlayEl?.remove();
    overlayEl  = null;
    subtitleEl = null;
  }

  function showSubtitle(text, isFinal) {
    if (!overlayEl) createOverlay();
    clearTimeout(clearTimer);

    subtitleEl.textContent   = text;
    subtitleEl.style.opacity = isFinal ? '1' : '0.65';

    if (isFinal) {
      clearTimer = setTimeout(() => {
        if (subtitleEl) subtitleEl.textContent = '';
      }, 3000);
    }
  }

  /* ─── STT 시작/중지 ─────────────────────────────────────────── */

  function startRecognition() {
    if (isRecognizing) return;

    chrome.storage.sync.get(['sourceLang'], (s) => {
      const langKey = s.sourceLang || 'auto';
      const lang    = LANG_MAP[langKey] || '';

      recognition               = new SpeechRecognition();
      recognition.continuous    = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      if (lang) recognition.lang = lang;

      recognition.onstart = () => {
        isRecognizing = true;
        restartCount  = 0;
        console.log('[LST STT] Started, lang:', lang || 'browser default');
        createOverlay();
      };

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          showSubtitle(r[0].transcript, r.isFinal);
        }
      };

      recognition.onerror = (event) => {
        console.warn('[LST STT] Error:', event.error);
        if (event.error === 'not-allowed') {
          autoRestart = false;
        }
      };

      recognition.onend = () => {
        isRecognizing = false;
        if (autoRestart && restartCount < MAX_RESTART) {
          restartCount++;
          setTimeout(() => { try { recognition?.start(); } catch (_) {} }, 200);
        }
      };

      autoRestart = true;
      try {
        recognition.start();
      } catch (e) {
        console.error('[LST STT] Failed to start:', e);
      }
    });
  }

  function stopRecognition() {
    autoRestart = false;
    try { recognition?.abort(); } catch (_) {}
    recognition   = null;
    isRecognizing = false;
    removeOverlay();
    console.log('[LST STT] Stopped');
  }

  /* ─── 메시지 수신 ───────────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'startSttCapture') {
      startRecognition();
      sendResponse({ success: true });
    } else if (message.action === 'stopCapture') {
      stopRecognition();
      sendResponse({ success: true });
    } else if (message.action === 'tabCaptureActive') {
      createOverlay();
      if (subtitleEl) {
        subtitleEl.textContent = '탭 오디오 캡처 중...';
        subtitleEl.style.opacity = '0.7';
      }
      sendResponse({ success: true });
    } else if (message.action === 'tabCaptureInactive') {
      removeOverlay();
      sendResponse({ success: true });
    } else if (message.action === 'whisperTranscript') {
      showWhisperResult(message.text, message.translated, message.interim);
      sendResponse({ success: true });
    }
    return false;
  });

  /* ─── Whisper 결과 표시 ──────────────────────────────────────── */

  function showWhisperResult(original, translated, interim) {
    if (!original?.trim()) return;
    const isSame = !translated || translated.trim() === original.trim();
    const display = isSame ? original : `${original}\n${translated}`;
    showSubtitle(display, !interim);
  }

  console.log('[LST STT] Content script loaded');
})();

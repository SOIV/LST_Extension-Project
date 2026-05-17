/**
 * LST - STT Content Script (Web Speech API + Whisper 탭 캡처)
 * Plain IIFE — manifest content_scripts에서 직접 로드
 *
 * 자막 렌더링은 SubtitleRenderer(community/subtitle-renderer.js)의
 * sttShow / sttClear 메서드에 위임 → 상단(원어) + 하단(번역) 두 패널 구조
 */
(function () {
  'use strict';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const LANG_MAP = {
    'ko': 'ko-KR', 'en': 'en-US', 'ja': 'ja-JP',
    'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
    'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'ru': 'ru-RU',
  };

  let recognition   = null;
  let isRecognizing = false;
  let autoRestart   = false;
  let restartCount  = 0;
  const MAX_RESTART = 5;

  /* SttRenderer는 같은 content_scripts 항목에서 먼저 로드됨 */

  /* ─── STT 시작/중지 ─────────────────────────────────────── */

  function startRecognition() {
    if (!SpeechRecognition) {
      console.warn('[LST STT] Web Speech API not supported');
      return;
    }
    if (isRecognizing) return;

    chrome.storage.sync.get(['sourceLang'], (s) => {
      const langKey = s.sourceLang || 'auto';
      const lang    = LANG_MAP[langKey] || '';

      recognition                = new SpeechRecognition();
      recognition.continuous     = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      if (lang) recognition.lang = lang;

      recognition.onstart = () => {
        isRecognizing = true;
        restartCount  = 0;
        console.log('[LST STT] Started, lang:', lang || 'browser default');
      };

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          SttRenderer.show(r[0].transcript, null, !r.isFinal);
        }
      };

      recognition.onerror = (event) => {
        console.warn('[LST STT] Error:', event.error);
        if (event.error === 'not-allowed') autoRestart = false;
      };

      recognition.onend = () => {
        isRecognizing = false;
        if (autoRestart && restartCount < MAX_RESTART) {
          restartCount++;
          setTimeout(() => { try { recognition?.start(); } catch (_) {} }, 200);
        }
      };

      autoRestart = true;
      try { recognition.start(); }
      catch (e) { console.error('[LST STT] Failed to start:', e); }
    });
  }

  function stopRecognition() {
    autoRestart = false;
    try { recognition?.abort(); } catch (_) {}
    recognition   = null;
    isRecognizing = false;
    SttRenderer.clear();
    console.log('[LST STT] Stopped');
  }

  /* ─── 메시지 수신 ───────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'startSttCapture') {
      startRecognition();
      sendResponse({ success: true });

    } else if (message.action === 'stopCapture') {
      stopRecognition();
      sendResponse({ success: true });

    } else if (message.action === 'tabCaptureActive') {
      SttRenderer.show('캡처 중...', null, true);
      sendResponse({ success: true });

    } else if (message.action === 'tabCaptureInactive') {
      SttRenderer.clear();
      sendResponse({ success: true });

    } else if (message.action === 'whisperTranscript') {
      showWhisperResult(message.text, message.translated, message.interim);
      sendResponse({ success: true });
    }

    return false;
  });

  /* ─── Whisper 결과 표시 ──────────────────────────────────── */

  function showWhisperResult(original, translated, interim) {
    if (!original?.trim()) return;
    const isSame = !translated || translated.trim() === original.trim();
    SttRenderer.show(original, isSame ? null : translated, !!interim);
  }

  console.log('[LST STT] Content script loaded');
})();

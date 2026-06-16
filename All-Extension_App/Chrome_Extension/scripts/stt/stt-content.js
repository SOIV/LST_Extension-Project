/**
 * LST - STT Content Script (Web Speech API + Whisper 탭 캡처)
 * Plain IIFE — manifest content_scripts에서 직접 로드
 *
 * 자막 렌더링은 SttRenderer(scripts/stt/stt-renderer.js)의
 * show / clear 메서드에 위임 → 상단(원어) + 하단(번역) 두 패널 구조
 */
(function () {
  'use strict';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // BCP-47 언어 코드 (Web Speech API lang 속성용)
  const LANG_BCP47 = {
    'ko': 'ko-KR', 'en': 'en-US', 'ja': 'ja-JP',
    'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
    'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'ru': 'ru-RU',
  };

  let recognition      = null;
  let isRecognizing    = false;
  let autoRestart      = false;
  let restartCount     = 0;
  const MAX_RESTART    = 5;
  let sttActive        = false;
  let sttSessionId     = 0;

  // ── Web Speech API 버퍼 / 타이머 ──────────────────────────
  // 텍스트 안정성 기반 침묵 타이머:
  //   새 이벤트마다 리셋하는 게 아니라, 텍스트가 '바뀔 때만' 리셋.
  //   인식기가 더 이상 새 단어를 추가하지 않으면 silenceMs 후 flush.
  let wsInterimBuffer         = '';  // 현재 누적 인식 텍스트
  let wsLastKnownText         = '';  // 마지막으로 확인한 텍스트 (변경 감지용)
  let wsStabilityTimer        = null; // 텍스트 안정성 타이머
  let wsMaxBufferTimer        = null; // 최대 버퍼 타이머 (무중단 발화 안전망)
  let wsInterimTranslateTimer = null; // 중간 번역 디바운스 타이머

  // 문장 끝 부호 (감지 시 즉시 flush)
  const SENTENCE_END = /[。！？.!?…][」』"']?\s*$/;

  /* SttRenderer는 같은 content_scripts 항목에서 먼저 로드됨 */

  /* ─── 번역 (다중 엔진) ──────────────────────────────────── */

  async function translateText(text, sourceLang, targetLang, opts = {}) {
    if (!targetLang || targetLang === sourceLang) return text;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translateText',
        text,
        sourceLang,
        targetLang,
        opts,
      });
      if (response?.success) return response.translated || text;
    } catch (err) {
      console.debug('[LST STT] Background translation failed:', err.message);
    }

    return text;
  }

  /* ─── 버퍼 정리 헬퍼 ────────────────────────────────────── */

  function clearWsTimers() {
    clearTimeout(wsStabilityTimer);
    clearTimeout(wsMaxBufferTimer);
    clearTimeout(wsInterimTranslateTimer);
    wsStabilityTimer        = null;
    wsMaxBufferTimer        = null;
    wsInterimTranslateTimer = null;
  }

  function resetWsState() {
    clearWsTimers();
    wsInterimBuffer  = '';
    wsLastKnownText  = '';
  }

  function beginSttSession() {
    sttActive = true;
    sttSessionId++;
    return sttSessionId;
  }

  function endSttSession() {
    sttActive = false;
    sttSessionId++;
  }

  /* ─── STT 시작/중지 ─────────────────────────────────────── */

  function getSyncSettings(keys) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, (settings) => resolve(settings || {}));
    });
  }

  async function startRecognition() {
    if (!SpeechRecognition) {
      console.warn('[LST STT] Web Speech API not supported');
      return false;
    }
    if (isRecognizing) return true;
    const sessionId = beginSttSession();

    const storageKeys = [
      'sourceLang', 'targetLang',
      'translationEngine',
      'sttSilenceMs',
      'interimTranslationEnabled', 'interimTranslationEngine',
    ];

    const s = await getSyncSettings(storageKeys);
    if (!sttActive || sessionId !== sttSessionId) return false;
    const sourceLang = s.sourceLang || 'auto';
    const targetLang = s.targetLang || 'ko';
    const lang       = LANG_BCP47[sourceLang] || '';
    const silenceMs  = s.sttSilenceMs ?? 1500;
    // 최대 버퍼 타이머: silenceMs * 4, 최소 4s, 최대 8s
    const maxBufferMs = Math.min(Math.max(silenceMs * 4, 4000), 8000);

      // 메인 번역 옵션
      const translationOpts = {
        engine: s.translationEngine || 'google',
        scope:  'main',
      };

      // 중간 번역 옵션
      let interimOpts = null;
      if (s.interimTranslationEnabled) {
        if (!s.interimTranslationEngine || s.interimTranslationEngine === 'same') {
          interimOpts = translationOpts;
        } else {
          interimOpts = {
            engine: s.interimTranslationEngine || 'google',
            scope:  'interim',
          };
        }
      }

      // 최종 번역 후 렌더링
      function translateAndShow(text) {
        if (!sttActive || sessionId !== sttSessionId) return;
        translateText(text, sourceLang, targetLang, translationOpts)
          .then((translated) => {
            if (!sttActive || sessionId !== sttSessionId) return;
            const isSame = !translated || translated.trim() === text.trim();
            SttRenderer.show(text, isSame ? null : translated, false);
          })
          .catch(() => {
            if (!sttActive || sessionId !== sttSessionId) return;
            SttRenderer.show(text, null, false);
          });
      }

      // 버퍼 flush (최종 처리)
      function flushBuffer() {
        const finalText = wsInterimBuffer.trim();
        resetWsState();
        if (finalText) translateAndShow(finalText);
      }

      recognition                 = new SpeechRecognition();
      recognition.continuous      = true;
      recognition.interimResults  = true;
      recognition.maxAlternatives = 1;
      if (lang) recognition.lang  = lang;

      recognition.onstart = () => {
        isRecognizing = true;
        restartCount  = 0;
        console.log('[LST STT] Started, lang:', lang || 'browser default');
      };

      recognition.onresult = (event) => {
        if (!sttActive || sessionId !== sttSessionId) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r    = event.results[i];
          const text = r[0].transcript;

          if (r.isFinal) {
            // Web Speech API VAD가 발화 끊김 감지 → 모든 타이머 취소 후 즉시 번역
            resetWsState();
            translateAndShow(text);
            continue;
          }

          // ── 중간 결과 처리 ────────────────────────────────

          // 원어 즉시 표시
          if (!sttActive || sessionId !== sttSessionId) return;
          SttRenderer.show(text, null, true);

          // 문장 부호 감지 시 즉시 flush (silenceMs 대기 없이)
          if (SENTENCE_END.test(text) && text !== wsLastKnownText) {
            wsInterimBuffer = text;
            wsLastKnownText = text;
            flushBuffer();
            continue;
          }

          // 텍스트가 바뀐 경우에만 안정성 타이머 리셋
          // → 말이 계속 와도 '인식기가 새 단어를 추가하지 않으면' silenceMs 후 flush
          if (text !== wsLastKnownText) {
            wsLastKnownText = text;
            wsInterimBuffer = text;

            // 텍스트 안정성 타이머 (텍스트 변경 시마다 리셋)
            clearTimeout(wsStabilityTimer);
            wsStabilityTimer = setTimeout(flushBuffer, silenceMs);

            // 최대 버퍼 타이머 (처음 시작 후 리셋 없음 — 안전망)
            if (!wsMaxBufferTimer) {
              wsMaxBufferTimer = setTimeout(flushBuffer, maxBufferMs);
            }

            // 중간 번역: 400ms 디바운스
            if (interimOpts) {
              clearTimeout(wsInterimTranslateTimer);
              wsInterimTranslateTimer = setTimeout(() => {
                if (!sttActive || sessionId !== sttSessionId) return;
                const interimText = wsInterimBuffer;
                if (!interimText?.trim()) return;
                translateText(interimText, sourceLang, targetLang, interimOpts)
                  .then((translated) => {
                    if (!sttActive || sessionId !== sttSessionId) return;
                    if (interimText !== wsInterimBuffer) return; // 스테일 방지
                    const isSame = !translated || translated.trim() === interimText.trim();
                    SttRenderer.show(interimText, isSame ? null : translated, true);
                  })
                  .catch(() => {});
              }, 400);
            }
          }
        }
      };

      recognition.onerror = (event) => {
        // 'aborted': abort() 직접 호출 또는 브라우저 세션 종료 시 정상 발생 → 무시
        if (event.error === 'aborted') return;
        console.warn('[LST STT] Error:', event.error);
        if (event.error === 'not-allowed') autoRestart = false;
      };

      recognition.onend = () => {
        resetWsState();
        isRecognizing = false;
        if (autoRestart && sttActive && sessionId === sttSessionId && restartCount < MAX_RESTART) {
          restartCount++;
          setTimeout(() => { try { recognition?.start(); } catch (_) {} }, 200);
        } else if (sttActive && sessionId === sttSessionId) {
          // 재시작 한도 초과 또는 예기치 않은 종료 → 전체 정리 후 background에 알림
          stopRecognition();
          chrome.runtime.sendMessage({ action: 'stopSttForCurrentTab' }).catch(() => {});
        }
      };

      autoRestart = true;
      try {
        recognition.start();
      } catch (e) {
        console.error('[LST STT] Failed to start:', e);
        autoRestart = false;
        endSttSession();
        recognition = null;
        return false;
      }
    return true;
  }

  function stopRecognition() {
    autoRestart = false;
    endSttSession();
    resetWsState();
    try { recognition?.abort(); } catch (_) {}
    recognition   = null;
    isRecognizing = false;
    SttRenderer.clear();
    console.log('[LST STT] Stopped');
  }

  /* ─── 메시지 수신 ───────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'lstSttPing') {
      sendResponse({ success: true });

    } else if (message.action === 'startSttCapture') {
      startRecognition()
        .then(started => sendResponse({
          success: !!started,
          error: started ? undefined : 'Web Speech API failed to start',
        }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;

    } else if (message.action === 'stopCapture') {
      stopRecognition();
      sendResponse({ success: true });

    } else if (message.action === 'tabCaptureActive') {
      beginSttSession();
      SttRenderer.show('캡처 중...', null, true);
      sendResponse({ success: true });

    } else if (message.action === 'tabCaptureInactive') {
      endSttSession();
      SttRenderer.clear();
      sendResponse({ success: true });

    } else if (message.action === 'whisperTranscript') {
      showWhisperResult(message.text, message.translated, message.interim);
      sendResponse({ success: true });
    }

    return false;
  });

  /* ─── Whisper / Realtime 결과 표시 ──────────────────────── */

  function showWhisperResult(original, translated, interim) {
    if (!sttActive) return;
    if (!original?.trim()) return;
    const isSame = !translated || translated.trim() === original.trim();
    SttRenderer.show(original, isSame ? null : translated, !!interim);
  }

  console.log('[LST STT] Content script loaded');
})();

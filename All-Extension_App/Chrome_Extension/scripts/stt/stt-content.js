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

  // ISO 639-1 언어 코드 (번역 API용)
  const LANG_ISO = {
    'ko': 'ko', 'en': 'en', 'ja': 'ja',
    'zh-CN': 'zh', 'zh-TW': 'zh',
    'es': 'es', 'fr': 'fr', 'de': 'de', 'ru': 'ru',
  };

  let recognition      = null;
  let isRecognizing    = false;
  let autoRestart      = false;
  let restartCount     = 0;
  const MAX_RESTART    = 5;

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

    const sl = sourceLang === 'auto' ? 'auto' : (LANG_ISO[sourceLang] || sourceLang);
    const tl = LANG_ISO[targetLang] || targetLang;

    try {
      switch (opts.engine) {
        case 'google_script':
          if (opts.googleScriptUrl) return await translateWithScript(text, sl, tl, opts.googleScriptUrl);
          break;

        case 'papago':
          if (opts.papagoApiKey) return await translateWithPapago(text, sl, tl, opts.papagoApiKey, opts.papagoApiSecret);
          break;

        case 'deepl':
          if (opts.deeplApiKey) return await translateWithDeepL(text, sl, tl, opts.deeplApiKey);
          break;
      }
    } catch (err) {
      // fetch 취소(중단) 등 예상 가능한 실패는 debug 레벨로만 기록
      console.debug('[LST STT] Translation fallback to Google:', err.message);
    }

    return translateWithGoogle(text, sl, tl);
  }

  async function translateWithGoogle(text, sl, tl) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return text;
      const data = await res.json();
      return data[0]?.map(i => i[0]).filter(Boolean).join('') || text;
    } catch {
      return text;
    }
  }

  async function translateWithScript(text, sl, tl, scriptUrl) {
    const res = await fetch(scriptUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, source: sl, target: tl }),
    });
    if (!res.ok) throw new Error(`Script API ${res.status}`);
    const data = await res.json();
    return data.translatedText || data.text || text;
  }

  async function translateWithPapago(text, sl, tl, apiKey, apiSecret) {
    const res = await fetch('https://naveropenapi.apigw.ntruss.com/nmt/v1/translation', {
      method:  'POST',
      headers: {
        'Content-Type':           'application/x-www-form-urlencoded; charset=UTF-8',
        'X-NCP-APIGW-API-KEY-ID': apiKey,
        'X-NCP-APIGW-API-KEY':    apiSecret,
      },
      body: `source=${sl}&target=${tl}&text=${encodeURIComponent(text)}`,
    });
    if (!res.ok) throw new Error(`Papago API ${res.status}`);
    const data = await res.json();
    return data.message.result.translatedText;
  }

  async function translateWithDeepL(text, sl, tl, apiKey) {
    const DEEPL_LANG = {
      'ko': 'KO', 'en': 'EN', 'ja': 'JA', 'zh': 'ZH',
      'de': 'DE', 'fr': 'FR', 'es': 'ES', 'ru': 'RU',
    };
    const targetCode = DEEPL_LANG[tl] || tl.toUpperCase();
    const sourceCode = (sl && sl !== 'auto') ? (DEEPL_LANG[sl] || sl.toUpperCase()) : '';

    const url = apiKey.includes(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const params = new URLSearchParams({ auth_key: apiKey, text, target_lang: targetCode });
    if (sourceCode) params.append('source_lang', sourceCode);

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params,
    });
    if (!res.ok) throw new Error(`DeepL API ${res.status}`);
    const data = await res.json();
    return data.translations[0].text;
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

  /* ─── STT 시작/중지 ─────────────────────────────────────── */

  function startRecognition() {
    if (!SpeechRecognition) {
      console.warn('[LST STT] Web Speech API not supported');
      return;
    }
    if (isRecognizing) return;

    const storageKeys = [
      'sourceLang', 'targetLang',
      'translationEngine', 'googleScriptUrl',
      'papagoApiKey', 'papagoApiSecret', 'deeplApiKey',
      'sttSilenceMs',
      'interimTranslationEnabled', 'interimTranslationEngine',
      'interimGoogleScriptUrl',
      'interimPapagoApiKey', 'interimPapagoApiSecret', 'interimDeeplApiKey',
    ];

    chrome.storage.sync.get(storageKeys, (s) => {
      const sourceLang = s.sourceLang || 'auto';
      const targetLang = s.targetLang || 'ko';
      const lang       = LANG_BCP47[sourceLang] || '';
      const silenceMs  = s.sttSilenceMs ?? 1500;
      // 최대 버퍼 타이머: silenceMs * 4, 최소 4s, 최대 8s
      const maxBufferMs = Math.min(Math.max(silenceMs * 4, 4000), 8000);

      // 메인 번역 옵션
      const translationOpts = {
        engine:          s.translationEngine || 'google',
        googleScriptUrl: s.googleScriptUrl   || '',
        papagoApiKey:    s.papagoApiKey      || '',
        papagoApiSecret: s.papagoApiSecret   || '',
        deeplApiKey:     s.deeplApiKey       || '',
      };

      // 중간 번역 옵션
      let interimOpts = null;
      if (s.interimTranslationEnabled) {
        if (!s.interimTranslationEngine || s.interimTranslationEngine === 'same') {
          interimOpts = translationOpts;
        } else {
          interimOpts = {
            engine:          s.interimTranslationEngine || 'google',
            googleScriptUrl: s.interimGoogleScriptUrl   || '',
            papagoApiKey:    s.interimPapagoApiKey      || '',
            papagoApiSecret: s.interimPapagoApiSecret   || '',
            deeplApiKey:     s.interimDeeplApiKey       || '',
          };
        }
      }

      // 최종 번역 후 렌더링
      function translateAndShow(text) {
        translateText(text, sourceLang, targetLang, translationOpts)
          .then((translated) => {
            const isSame = !translated || translated.trim() === text.trim();
            SttRenderer.show(text, isSame ? null : translated, false);
          })
          .catch(() => SttRenderer.show(text, null, false));
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
                const interimText = wsInterimBuffer;
                if (!interimText?.trim()) return;
                translateText(interimText, sourceLang, targetLang, interimOpts)
                  .then((translated) => {
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
    resetWsState();
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

  /* ─── Whisper / Realtime 결과 표시 ──────────────────────── */

  function showWhisperResult(original, translated, interim) {
    if (!original?.trim()) return;
    const isSame = !translated || translated.trim() === original.trim();
    SttRenderer.show(original, isSame ? null : translated, !!interim);
  }

  console.log('[LST STT] Content script loaded');
})();

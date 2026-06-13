/**
 * LST - Offscreen Document (Tab Audio Capture + STT)
 *
 * 흐름 — Whisper (sttEngine: 'whisper'):
 *   background → tabCaptureStream(streamId) → getUserMedia
 *             → MediaRecorder(3s 청크) → Whisper API → translate → background
 *
 * 흐름 — Realtime (sttEngine: 'realtime'):
 *   background → tabCaptureStream(streamId) → getUserMedia
 *             → RTCPeerConnection → OpenAI Realtime API (WebRTC)
 *             → transcript 이벤트 → translate → background
 *
 * background → tabCaptureStop → 스트림/연결 정리
 */

(function () {
  'use strict';

  // ISO 639-1 언어 코드 매핑
  const LANG_ISO = {
    'ko': 'ko', 'en': 'en', 'ja': 'ja',
    'zh-CN': 'zh', 'zh-TW': 'zh',
    'es': 'es', 'fr': 'fr', 'de': 'de', 'ru': 'ru',
  };

  let audioCtx      = null;
  let activeStream  = null;
  let captureActive = false;
  let captureSessionId = 0;
  let stoppingCapture = false;

  // Whisper
  let mediaRecorder = null;

  // Realtime WebRTC
  let realtimePc                    = null;
  let realtimeDc                    = null;
  let realtimeInterimBuffer = '';
  let realtimeSilenceTimer  = null;  // 폴백용 수동 침묵 타이머
  let realtimeInterimTranslateTimer = null;
  let realtimeInterimTranslateInFlight = false;
  let realtimeLastInterimTranslateAt = 0;
  let realtimeLastTranslatedInterim = '';
  let realtimeSilenceMs     = 1500;
  const REALTIME_INTERIM_TRANSLATE_INTERVAL_MS = 900;
  let realtimeConfig = null;
  let realtimeReconnectTimer = null;
  let realtimeReconnectAttempts = 0;
  let realtimeRestarting = false;
  const REALTIME_DISCONNECTED_GRACE_MS = 5000;
  const REALTIME_RECONNECT_BASE_DELAY_MS = 1500;
  const REALTIME_RECONNECT_MAX_DELAY_MS = 30000;


  /* ─── 메시지 수신 ─────────────────────────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'tabCaptureStream') {
      startCapture(message.streamId, message.settings || {})
        .then(() => sendResponse({ success: true }))
        .catch(e => {
          console.error('[LST Offscreen] Capture failed:', e);
          sendResponse({ success: false, error: e.message });
        });
      return true;
    }

    if (message.action === 'tabCaptureStop') {
      stopCapture({ notifyBackground: false });
      sendResponse({ success: true });
    }
  });

  /* ─── 캡처 시작 ───────────────────────────────────────────────────────────── */

  function beginCaptureSession() {
    captureActive = true;
    captureSessionId++;
    return captureSessionId;
  }

  function endCaptureSession() {
    captureActive = false;
    captureSessionId++;
  }

  function isCaptureSessionActive(sessionId) {
    return captureActive && sessionId === captureSessionId;
  }

  function sendTranscript(sessionId, payload) {
    if (!isCaptureSessionActive(sessionId)) return;
    chrome.runtime.sendMessage({ action: 'whisperTranscript', ...payload }).catch(() => {});
  }

  function notifyCaptureStopped(reason) {
    chrome.runtime.sendMessage({ action: 'tabCaptureStopped', reason }).catch(() => {});
  }

  async function startCapture(streamId, stored) {
    stopCapture({ notifyBackground: false });
    const sessionId = beginCaptureSession();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
          },
        },
        video: false,
      });
    } catch (err) {
      if (isCaptureSessionActive(sessionId)) endCaptureSession();
      throw err;
    }

    activeStream = stream;
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        if (!isCaptureSessionActive(sessionId) || stoppingCapture) return;
        console.warn('[LST Offscreen] Audio track ended');
        stopCapture({ notifyBackground: true, reason: 'audio_track_ended' });
      }, { once: true });
    });

    audioCtx     = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(audioCtx.destination);

    const {
      openaiApiKey,
      sourceLang  = 'auto',
      targetLang  = 'ko',
      sttEngine    = 'whisper',
      whisperModel  = 'gpt-4o-mini-transcribe',
      realtimeModel = 'gpt-realtime-whisper',
      sttSilenceMs: silenceMs = 1500,
      translationEngine         = 'google',
      googleScriptUrl           = '',
      papagoApiKey              = '',
      papagoApiSecret           = '',
      deeplApiKey               = '',
      interimTranslationEnabled = false,
      interimTranslationEngine  = 'same',
    } = stored;

    // 메인 번역 옵션
    const translationOpts = { engine: translationEngine, googleScriptUrl, papagoApiKey, papagoApiSecret, deeplApiKey };

    // 중간 번역 옵션: 비활성 → null / 'same' → 메인과 동일 / 그 외 → 전용 키 사용
    let interimOpts = null;
    if (interimTranslationEnabled) {
      if (interimTranslationEngine === 'same') {
        interimOpts = translationOpts;
      } else {
        interimOpts = {
          engine:         interimTranslationEngine,
          googleScriptUrl,
          papagoApiKey,
          papagoApiSecret,
          deeplApiKey,
        };
      }
    }

    realtimeSilenceMs = silenceMs;

    try {
      if (!openaiApiKey) {
        console.warn('[LST Offscreen] openaiApiKey not set — STT disabled');
      } else if (sttEngine === 'realtime') {
        realtimeConfig = {
          sessionId,
          stream,
          apiKey: openaiApiKey,
          sourceLang,
          targetLang,
          translationOpts,
          interimOpts,
          model: realtimeModel,
        };
        await startRealtimeSTT(sessionId, stream, openaiApiKey, sourceLang, targetLang, translationOpts, interimOpts, realtimeModel);
      } else {
        realtimeConfig = null;
        startWhisperRecorder(sessionId, stream, openaiApiKey, sourceLang, targetLang, translationOpts, whisperModel);
      }
    } catch (err) {
      if (isCaptureSessionActive(sessionId)) stopCapture();
      throw err;
    }

    console.log('[LST Offscreen] Tab audio capture started, engine:', sttEngine);
  }

  /* ─── Whisper 녹음 ────────────────────────────────────────────────────────── */

  function startWhisperRecorder(sessionId, stream, apiKey, sourceLang, targetLang, translationOpts, model = 'gpt-4o-mini-transcribe') {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    let chunks = [];

    // stop() 호출 시 ondataavailable + onstop 순서로 완전한 webm 파일이 만들어짐.
    // start(timeslice) 방식은 첫 청크 이후 헤더가 없어 Whisper가 파싱 불가.
    function next() {
      const rec = new MediaRecorder(stream, { mimeType });

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      rec.onstop = async () => {
        if (!isCaptureSessionActive(sessionId)) {
          chunks = [];
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        chunks = [];

        if (blob.size >= 1000) {
          try {
            const transcript = await callWhisperApi(blob, apiKey, sourceLang, mimeType, model);
            if (!isCaptureSessionActive(sessionId)) return;
            if (transcript?.trim()) {
              const translated = await translateText(transcript, sourceLang, targetLang, translationOpts);
              sendTranscript(sessionId, {
                text:       transcript,
                translated: translated,
              });
            }
          } catch (err) {
            console.error('[LST Offscreen] Whisper error:', err.message);
          }
        }

        // mediaRecorder가 null이면 stopCapture()가 호출된 것 → 재시작 안 함
        if (mediaRecorder !== null && isCaptureSessionActive(sessionId)) {
          mediaRecorder = next();
        }
      };

      rec.start();
      setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, 3000);

      return rec;
    }

    mediaRecorder = next();
    console.log('[LST Offscreen] Whisper recorder started');
  }

  /* ─── Whisper API 호출 ────────────────────────────────────────────────────── */

  async function callWhisperApi(blob, apiKey, sourceLang, mimeType, model = 'gpt-4o-mini-transcribe') {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', model);

    const isoLang = LANG_ISO[sourceLang];
    if (isoLang) formData.append('language', isoLang);

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.status);
      throw new Error(`${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.text ?? '';
  }

  /* ─── 번역 (다중 엔진) ────────────────────────────────────────────────────── */

  async function translateText(text, sourceLang, targetLang, opts = {}) {
    if (!targetLang || targetLang === sourceLang) return text;

    const sl = sourceLang === 'auto' ? 'auto' : (LANG_ISO[sourceLang] || sourceLang);
    const tl = LANG_ISO[targetLang] || targetLang;

    try {
      switch (opts.engine) {
        case 'google_script':
          if (opts.googleScriptUrl) return await translateWithScript(text, sl, tl, opts.googleScriptUrl);
          break; // fallthrough to Google

        case 'papago':
          if (opts.papagoApiKey) return await translateWithPapago(text, sl, tl, opts.papagoApiKey, opts.papagoApiSecret);
          break;

        case 'deepl':
          if (opts.deeplApiKey) return await translateWithDeepL(text, sl, tl, opts.deeplApiKey);
          break;
      }
    } catch (err) {
      console.debug('[LST Offscreen] Translation fallback to Google:', err.message);
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
    const url = normalizeAppsScriptUrl(scriptUrl);
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, source: sl, target: tl }),
    });
    if (!res.ok) throw new Error(`Script API ${res.status}`);
    const data = await res.json();
    return data.translatedText || data.text || text;
  }

  function normalizeAppsScriptUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const deploymentId = raw
      .replace(/^\/+|\/+$/g, '')
      .replace(/^macros\/s\//i, '')
      .replace(/\/(exec|dev)$/i, '');

    return `https://script.google.com/macros/s/${encodeURIComponent(deploymentId)}/exec`;
  }

  async function translateWithPapago(text, sl, tl, apiKey, apiSecret) {
    const res = await fetch('https://naveropenapi.apigw.ntruss.com/nmt/v1/translation', {
      method:  'POST',
      headers: {
        'Content-Type':          'application/x-www-form-urlencoded; charset=UTF-8',
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

  /* ─── Realtime WebRTC STT ────────────────────────────────────────────────── */

  async function startRealtimeSTT(sessionId, stream, apiKey, sourceLang, targetLang, translationOpts, interimOpts, model = 'gpt-realtime-whisper') {
    const ephemeralKey = await getEphemeralToken(apiKey, sourceLang, model);

    realtimePc = new RTCPeerConnection();
    realtimePc.ontrack = () => {};
    realtimePc.onconnectionstatechange = () => {
      const state = realtimePc?.connectionState;
      if (!isCaptureSessionActive(sessionId) || stoppingCapture || realtimeRestarting) return;
      if (state === 'connected') {
        realtimeReconnectAttempts = 0;
        clearTimeout(realtimeReconnectTimer);
        realtimeReconnectTimer = null;
        return;
      }
      if (state === 'disconnected') {
        console.warn('[LST Realtime] WebRTC connection disconnected');
        scheduleRealtimeReconnect(sessionId, 'realtime_disconnected', REALTIME_DISCONNECTED_GRACE_MS);
      } else if (state === 'failed' || state === 'closed') {
        console.warn('[LST Realtime] WebRTC connection ended:', state);
        scheduleRealtimeReconnect(sessionId, `realtime_${state}`);
      }
    };

    stream.getAudioTracks().forEach(track => realtimePc.addTrack(track, stream));

    realtimeDc = realtimePc.createDataChannel('oai-events');
    realtimeDc.onopen  = () => console.log('[LST Realtime] Data channel open');
    realtimeDc.onclose = () => {
      console.log('[LST Realtime] Data channel closed');
      if (!isCaptureSessionActive(sessionId) || stoppingCapture || realtimeRestarting) return;
      scheduleRealtimeReconnect(sessionId, 'realtime_data_channel_closed');
    };
    realtimeDc.onmessage = (e) => {
      try {
        handleRealtimeEvent(sessionId, JSON.parse(e.data), sourceLang, targetLang, translationOpts, interimOpts);
      } catch (err) {
        console.error('[LST Realtime] Event parse error:', err);
      }
    };

    const offer = await realtimePc.createOffer();
    await realtimePc.setLocalDescription(offer);

    const answerSdp = await sendSdpOffer(offer.sdp, ephemeralKey);
    await realtimePc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    console.log('[LST Realtime] WebRTC connection established');
  }

  function getRealtimeReconnectDelay() {
    return Math.min(
      REALTIME_RECONNECT_BASE_DELAY_MS * (2 ** Math.max(realtimeReconnectAttempts - 1, 0)),
      REALTIME_RECONNECT_MAX_DELAY_MS,
    );
  }

  function scheduleRealtimeReconnect(sessionId, reason, delayMs = getRealtimeReconnectDelay()) {
    if (!isCaptureSessionActive(sessionId) || stoppingCapture) return;
    if (!realtimeConfig || realtimeConfig.sessionId !== sessionId) return;
    if (realtimeReconnectTimer) return;

    console.warn('[LST Realtime] Reconnect scheduled:', reason, `${delayMs}ms`);
    realtimeReconnectTimer = setTimeout(() => {
      realtimeReconnectTimer = null;
      reconnectRealtime(sessionId, reason);
    }, delayMs);
  }

  function isFatalRealtimeReconnectError(err) {
    const message = err?.message || '';
    return /(?:Session creation|SDP exchange) failed:\s*(400|401|403|404)\b/.test(message);
  }

  async function reconnectRealtime(sessionId, reason) {
    if (!isCaptureSessionActive(sessionId) || stoppingCapture) return;
    if (!realtimeConfig || realtimeConfig.sessionId !== sessionId) return;

    const state = realtimePc?.connectionState;
    if (reason === 'realtime_disconnected' && (state === 'connected' || state === 'connecting')) {
      return;
    }

    realtimeReconnectAttempts++;
    realtimeRestarting = true;
    console.warn('[LST Realtime] Reconnecting:', reason, `(attempt ${realtimeReconnectAttempts})`);

    try {
      stopRealtimeSTT({ preserveConfig: true });
      if (!isCaptureSessionActive(sessionId)) return;

      await startRealtimeSTT(
        realtimeConfig.sessionId,
        realtimeConfig.stream,
        realtimeConfig.apiKey,
        realtimeConfig.sourceLang,
        realtimeConfig.targetLang,
        realtimeConfig.translationOpts,
        realtimeConfig.interimOpts,
        realtimeConfig.model,
      );
    } catch (err) {
      console.warn('[LST Realtime] Reconnect failed:', err.message);
      if (!isCaptureSessionActive(sessionId)) return;
      if (isFatalRealtimeReconnectError(err)) {
        stopCapture({ notifyBackground: true, reason: 'realtime_reconnect_fatal' });
      } else {
        scheduleRealtimeReconnect(sessionId, 'realtime_reconnect_error');
      }
    } finally {
      realtimeRestarting = false;
    }
  }

  async function getEphemeralToken(apiKey, sourceLang, model = 'gpt-realtime-whisper') {
    const transcription = { model };
    const isoLang = LANG_ISO[sourceLang];
    if (isoLang && sourceLang !== 'auto') transcription.language = isoLang;

    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'transcription',
          audio: {
            input: { transcription },
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => String(res.status));
      throw new Error(`Session creation failed: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data.value;
  }

  async function sendSdpOffer(sdp, ephemeralKey) {
    const res = await fetch('https://api.openai.com/v1/realtime/calls', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${ephemeralKey}`,
        'Content-Type': 'application/sdp',
      },
      body: sdp,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => String(res.status));
      throw new Error(`SDP exchange failed: ${res.status} ${err}`);
    }

    return res.text();
  }

  async function handleRealtimeEvent(sessionId, event, sourceLang, targetLang, translationOpts, interimOpts) {
    if (!isCaptureSessionActive(sessionId)) return;
    switch (event.type) {
      case 'session.created':
        console.log('[LST Realtime] Session ready:', event.session?.id);
        break;

      case 'input_audio_buffer.speech_started':
        realtimeLastTranslatedInterim = '';
        console.log('[LST Realtime] Speech detected');
        break;

      case 'input_audio_buffer.speech_stopped': {
        // 서버 VAD가 발화 끝 감지 → 모든 타이머 취소 후 즉시 flush
        // completed 이벤트가 곧 도착하면 버퍼가 비어 있어 중복 처리 방지
        clearTimeout(realtimeSilenceTimer);
        clearTimeout(realtimeInterimTranslateTimer);
        realtimeSilenceTimer = null;
        realtimeInterimTranslateTimer = null;
        const vadText = realtimeInterimBuffer.trim();
        realtimeInterimBuffer = '';
        realtimeLastTranslatedInterim = '';
        console.log('[LST Realtime] Speech stopped (server VAD)');
        if (!vadText) break;
        const vadTranslated = await translateText(vadText, sourceLang, targetLang, translationOpts);
        sendTranscript(sessionId, { text: vadText, translated: vadTranslated, interim: false });
        break;
      }

      case 'conversation.item.input_audio_transcription.delta':
        if (event.delta) {
          realtimeInterimBuffer += event.delta;
          const currentText = realtimeInterimBuffer;
          if (!currentText.trim()) break;

          // 원문 즉시 표시
          sendTranscript(sessionId, { text: currentText, translated: '', interim: true });

          scheduleRealtimeInterimTranslation(sessionId, sourceLang, targetLang, interimOpts);

          // 폴백 침묵 타이머 (server VAD가 speech_stopped를 못 보낼 경우 대비)
          clearTimeout(realtimeSilenceTimer);
          realtimeSilenceTimer = setTimeout(async () => {
            if (!isCaptureSessionActive(sessionId)) return;
            const text = realtimeInterimBuffer.trim();
            realtimeInterimBuffer = '';
            realtimeLastTranslatedInterim = '';
            realtimeSilenceTimer  = null;
            if (!text) return;
            const translated = await translateText(text, sourceLang, targetLang, translationOpts);
            sendTranscript(sessionId, { text, translated, interim: false });
          }, realtimeSilenceMs);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        // speech_stopped가 이미 flush했으면 buffer가 비어 있음 → 중복 방지
        clearTimeout(realtimeSilenceTimer);
        clearTimeout(realtimeInterimTranslateTimer);
        realtimeSilenceTimer = null;
        realtimeInterimTranslateTimer = null;
        const remaining = realtimeInterimBuffer.trim();
        realtimeInterimBuffer = '';
        realtimeLastTranslatedInterim = '';
        // buffer에 아직 남은 텍스트가 있으면 completed transcript로 최종 처리
        const finalText = event.transcript?.trim() || remaining;
        if (!finalText) break;
        const translated = await translateText(finalText, sourceLang, targetLang, translationOpts);
        sendTranscript(sessionId, { text: finalText, translated, interim: false });
        break;
      }

      case 'error':
        console.error('[LST Realtime] API error:', event.error?.message ?? event.error);
        break;
    }
  }

  function scheduleRealtimeInterimTranslation(sessionId, sourceLang, targetLang, interimOpts) {
    if (!interimOpts) return;
    if (!isCaptureSessionActive(sessionId)) return;
    if (realtimeInterimTranslateInFlight) return;

    const delay = Math.max(
      0,
      REALTIME_INTERIM_TRANSLATE_INTERVAL_MS - (Date.now() - realtimeLastInterimTranslateAt),
    );

    if (realtimeInterimTranslateTimer) return;
    realtimeInterimTranslateTimer = setTimeout(() => {
      realtimeInterimTranslateTimer = null;
      runRealtimeInterimTranslation(sessionId, sourceLang, targetLang, interimOpts);
    }, delay);
  }

  async function runRealtimeInterimTranslation(sessionId, sourceLang, targetLang, interimOpts) {
    if (!isCaptureSessionActive(sessionId)) return;

    const interimText = realtimeInterimBuffer.trim();
    if (!interimText || interimText === realtimeLastTranslatedInterim) return;

    realtimeInterimTranslateInFlight = true;
    realtimeLastInterimTranslateAt = Date.now();

    try {
      const translated = await translateText(interimText, sourceLang, targetLang, interimOpts);
      if (!isCaptureSessionActive(sessionId)) return;

      const currentText = realtimeInterimBuffer.trim();
      if (!currentText) return;

      realtimeLastTranslatedInterim = interimText;
      sendTranscript(sessionId, { text: interimText, translated, interim: true });
    } catch (err) {
      console.debug('[LST Realtime] Interim translation failed:', err.message);
    } finally {
      realtimeInterimTranslateInFlight = false;
      if (isCaptureSessionActive(sessionId) && realtimeInterimBuffer.trim() !== realtimeLastTranslatedInterim) {
        scheduleRealtimeInterimTranslation(sessionId, sourceLang, targetLang, interimOpts);
      }
    }
  }

  function stopRealtimeSTT({ preserveConfig = false } = {}) {
    clearTimeout(realtimeReconnectTimer);
    realtimeReconnectTimer = null;
    realtimeDc?.close();
    realtimePc?.close();
    realtimeDc                    = null;
    realtimePc                    = null;
    realtimeInterimBuffer         = '';
    realtimeInterimTranslateInFlight = false;
    realtimeLastInterimTranslateAt = 0;
    realtimeLastTranslatedInterim = '';
    clearTimeout(realtimeSilenceTimer);
    clearTimeout(realtimeInterimTranslateTimer);
    realtimeSilenceTimer = null;
    realtimeInterimTranslateTimer = null;
    if (!preserveConfig) {
      realtimeConfig = null;
      realtimeReconnectAttempts = 0;
    }
    console.log('[LST Realtime] WebRTC connection closed');
  }

  /* ─── 캡처 중지 ───────────────────────────────────────────────────────────── */

  function stopCapture({ notifyBackground = false, reason = 'stopped' } = {}) {
    if (stoppingCapture) return;
    const shouldNotify = notifyBackground && captureActive;
    stoppingCapture = true;
    endCaptureSession();
    if (mediaRecorder?.state !== 'inactive') {
      mediaRecorder?.stop();
    }
    mediaRecorder = null;

    stopRealtimeSTT();

    activeStream?.getTracks().forEach(t => t.stop());
    activeStream = null;

    audioCtx?.close().catch(() => {});
    audioCtx = null;

    stoppingCapture = false;
    if (shouldNotify) notifyCaptureStopped(reason);
    console.log('[LST Offscreen] Tab audio capture stopped');
  }

  console.log('[LST Offscreen] Script loaded');
})();

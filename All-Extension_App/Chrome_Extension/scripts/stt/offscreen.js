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

  // Whisper
  let mediaRecorder = null;

  // Realtime WebRTC
  let realtimePc                    = null;
  let realtimeDc                    = null;
  let realtimeInterimBuffer = '';
  let realtimeSilenceTimer  = null;  // 폴백용 수동 침묵 타이머
  let realtimeInterimTranslateTimer = null;
  let realtimeSilenceMs     = 1500;


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
      stopCapture();
      sendResponse({ success: true });
    }
  });

  /* ─── 캡처 시작 ───────────────────────────────────────────────────────────── */

  async function startCapture(streamId, stored) {
    stopCapture();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    activeStream = stream;
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

    if (!openaiApiKey) {
      console.warn('[LST Offscreen] openaiApiKey not set — STT disabled');
    } else if (sttEngine === 'realtime') {
      await startRealtimeSTT(stream, openaiApiKey, sourceLang, targetLang, translationOpts, interimOpts, realtimeModel);
    } else {
      startWhisperRecorder(stream, openaiApiKey, sourceLang, targetLang, translationOpts, whisperModel);
    }

    console.log('[LST Offscreen] Tab audio capture started, engine:', sttEngine);
  }

  /* ─── Whisper 녹음 ────────────────────────────────────────────────────────── */

  function startWhisperRecorder(stream, apiKey, sourceLang, targetLang, translationOpts, model = 'gpt-4o-mini-transcribe') {
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
        const blob = new Blob(chunks, { type: mimeType });
        chunks = [];

        if (blob.size >= 1000) {
          try {
            const transcript = await callWhisperApi(blob, apiKey, sourceLang, mimeType, model);
            if (transcript?.trim()) {
              const translated = await translateText(transcript, sourceLang, targetLang, translationOpts);
              chrome.runtime.sendMessage({
                action:     'whisperTranscript',
                text:       transcript,
                translated: translated,
              });
            }
          } catch (err) {
            console.error('[LST Offscreen] Whisper error:', err.message);
          }
        }

        // mediaRecorder가 null이면 stopCapture()가 호출된 것 → 재시작 안 함
        if (mediaRecorder !== null) {
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

  async function startRealtimeSTT(stream, apiKey, sourceLang, targetLang, translationOpts, interimOpts, model = 'gpt-realtime-whisper') {
    const ephemeralKey = await getEphemeralToken(apiKey, sourceLang, model);

    realtimePc = new RTCPeerConnection();
    realtimePc.ontrack = () => {};

    stream.getAudioTracks().forEach(track => realtimePc.addTrack(track, stream));

    realtimeDc = realtimePc.createDataChannel('oai-events');
    realtimeDc.onopen  = () => console.log('[LST Realtime] Data channel open');
    realtimeDc.onclose = () => console.log('[LST Realtime] Data channel closed');
    realtimeDc.onmessage = (e) => {
      try {
        handleRealtimeEvent(JSON.parse(e.data), sourceLang, targetLang, translationOpts, interimOpts);
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

  async function handleRealtimeEvent(event, sourceLang, targetLang, translationOpts, interimOpts) {
    switch (event.type) {
      case 'session.created':
        console.log('[LST Realtime] Session ready:', event.session?.id);
        break;

      case 'input_audio_buffer.speech_started':
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
        console.log('[LST Realtime] Speech stopped (server VAD)');
        if (!vadText) break;
        const vadTranslated = await translateText(vadText, sourceLang, targetLang, translationOpts);
        chrome.runtime.sendMessage({ action: 'whisperTranscript', text: vadText, translated: vadTranslated, interim: false });
        break;
      }

      case 'conversation.item.input_audio_transcription.delta':
        if (event.delta) {
          realtimeInterimBuffer += event.delta;
          const currentText = realtimeInterimBuffer;
          if (!currentText.trim()) break;

          // 원문 즉시 표시
          chrome.runtime.sendMessage({
            action: 'whisperTranscript', text: currentText, translated: '', interim: true,
          });

          // 중간 번역: delta 폭주를 막기 위해 짧게 디바운스
          // stale 체크로 오래된 결과는 자동 폐기
          if (interimOpts) {
            clearTimeout(realtimeInterimTranslateTimer);
            realtimeInterimTranslateTimer = setTimeout(() => {
              const interimText = realtimeInterimBuffer;
              if (!interimText.trim()) return;
              translateText(interimText, sourceLang, targetLang, interimOpts)
                .then((translated) => {
                  if (interimText !== realtimeInterimBuffer) return; // 스테일 방지
                  chrome.runtime.sendMessage({ action: 'whisperTranscript', text: interimText, translated, interim: true });
                })
                .catch(() => {});
            }, 400);
          }

          // 폴백 침묵 타이머 (server VAD가 speech_stopped를 못 보낼 경우 대비)
          clearTimeout(realtimeSilenceTimer);
          realtimeSilenceTimer = setTimeout(async () => {
            const text = realtimeInterimBuffer.trim();
            realtimeInterimBuffer = '';
            realtimeSilenceTimer  = null;
            if (!text) return;
            const translated = await translateText(text, sourceLang, targetLang, translationOpts);
            chrome.runtime.sendMessage({ action: 'whisperTranscript', text, translated, interim: false });
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
        // buffer에 아직 남은 텍스트가 있으면 completed transcript로 최종 처리
        const finalText = event.transcript?.trim() || remaining;
        if (!finalText) break;
        const translated = await translateText(finalText, sourceLang, targetLang, translationOpts);
        chrome.runtime.sendMessage({ action: 'whisperTranscript', text: finalText, translated, interim: false });
        break;
      }

      case 'error':
        console.error('[LST Realtime] API error:', event.error?.message ?? event.error);
        break;
    }
  }

  function stopRealtimeSTT() {
    realtimeDc?.close();
    realtimePc?.close();
    realtimeDc                    = null;
    realtimePc                    = null;
    realtimeInterimBuffer         = '';
    clearTimeout(realtimeSilenceTimer);
    clearTimeout(realtimeInterimTranslateTimer);
    realtimeSilenceTimer = null;
    realtimeInterimTranslateTimer = null;
    console.log('[LST Realtime] WebRTC connection closed');
  }

  /* ─── 캡처 중지 ───────────────────────────────────────────────────────────── */

  function stopCapture() {
    if (mediaRecorder?.state !== 'inactive') {
      mediaRecorder?.stop();
    }
    mediaRecorder = null;

    stopRealtimeSTT();

    activeStream?.getTracks().forEach(t => t.stop());
    activeStream = null;

    audioCtx?.close().catch(() => {});
    audioCtx = null;

    console.log('[LST Offscreen] Tab audio capture stopped');
  }

  console.log('[LST Offscreen] Script loaded');
})();

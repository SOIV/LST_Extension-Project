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
  let realtimePc = null;
  let realtimeDc = null;

  /* ─── 메시지 수신 ─────────────────────────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'tabCaptureStream') {
      startCapture(message.streamId)
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

  async function startCapture(streamId) {
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

    const { openaiApiKey, sourceLang, targetLang, sttEngine } =
      await chrome.storage.sync.get(['openaiApiKey', 'sourceLang', 'targetLang', 'sttEngine']);

    if (!openaiApiKey) {
      console.warn('[LST Offscreen] openaiApiKey not set — STT disabled');
    } else if (sttEngine === 'realtime') {
      await startRealtimeSTT(stream, openaiApiKey, sourceLang || 'auto', targetLang || 'ko');
    } else {
      startWhisperRecorder(stream, openaiApiKey, sourceLang || 'auto', targetLang || 'ko');
    }

    console.log('[LST Offscreen] Tab audio capture started, engine:', sttEngine || 'whisper');
  }

  /* ─── Whisper 녹음 ────────────────────────────────────────────────────────── */

  function startWhisperRecorder(stream, apiKey, sourceLang, targetLang) {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = async (e) => {
      // 너무 작은 청크(묵음 등)는 건너뜀
      if (e.data.size < 1000) return;

      try {
        const transcript = await callWhisperApi(e.data, apiKey, sourceLang, mimeType);
        if (!transcript?.trim()) return;

        const translated = await translateText(transcript, sourceLang, targetLang);

        chrome.runtime.sendMessage({
          action:     'whisperTranscript',
          text:       transcript,
          translated: translated,
        });
      } catch (err) {
        console.error('[LST Offscreen] Whisper error:', err.message);
      }
    };

    mediaRecorder.start(3000); // 3초 단위 청크
    console.log('[LST Offscreen] Whisper recorder started');
  }

  /* ─── Whisper API 호출 ────────────────────────────────────────────────────── */

  async function callWhisperApi(blob, apiKey, sourceLang, mimeType) {
    const ext      = mimeType.includes('opus') ? 'webm' : 'webm';
    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'gpt-4o-mini-transcribe');

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

  /* ─── Google Translate (공개 API) ─────────────────────────────────────────── */

  async function translateText(text, sourceLang, targetLang) {
    if (!targetLang || targetLang === sourceLang) return text;

    const sl  = sourceLang === 'auto' ? 'auto' : (LANG_ISO[sourceLang] || sourceLang);
    const tl  = LANG_ISO[targetLang] || targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

    try {
      const res  = await fetch(url);
      if (!res.ok) return text;
      const data = await res.json();
      return data[0]?.map(i => i[0]).filter(Boolean).join('') || text;
    } catch {
      return text;
    }
  }

  /* ─── Realtime WebRTC STT ────────────────────────────────────────────────── */

  async function startRealtimeSTT(stream, apiKey, sourceLang, targetLang) {
    const ephemeralKey = await getEphemeralToken(apiKey);

    realtimePc = new RTCPeerConnection();

    // OpenAI에서 오는 오디오 트랙 수신 (응답 없는 transcription 모드라도 트랙 등록 필요)
    realtimePc.ontrack = () => {};

    // 탭 오디오 트랙을 OpenAI로 전송
    stream.getAudioTracks().forEach(track => realtimePc.addTrack(track, stream));

    // 이벤트 수신용 데이터 채널
    realtimeDc = realtimePc.createDataChannel('oai-events');
    realtimeDc.onopen  = () => console.log('[LST Realtime] Data channel open');
    realtimeDc.onclose = () => console.log('[LST Realtime] Data channel closed');
    realtimeDc.onmessage = (e) => {
      try {
        handleRealtimeEvent(JSON.parse(e.data), sourceLang, targetLang);
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

  async function getEphemeralToken(apiKey) {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-realtime-2',
        input_audio_transcription: { model: 'gpt-realtime-whisper' },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => String(res.status));
      throw new Error(`Session creation failed: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data.client_secret.value;
  }

  async function sendSdpOffer(sdp, ephemeralKey) {
    const res = await fetch(
      'https://api.openai.com/v1/realtime?model=gpt-realtime-2&intent=transcription',
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: sdp,
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => String(res.status));
      throw new Error(`SDP exchange failed: ${res.status} ${err}`);
    }

    return res.text();
  }

  async function handleRealtimeEvent(event, sourceLang, targetLang) {
    switch (event.type) {
      case 'session.created':
        console.log('[LST Realtime] Session ready:', event.session?.id);
        break;

      case 'input_audio_buffer.speech_started':
        console.log('[LST Realtime] Speech detected');
        break;

      case 'conversation.item.input_audio_transcription.delta':
        // interim — 번역 없이 원문만 빠르게 표시
        if (event.delta?.trim()) {
          chrome.runtime.sendMessage({
            action:     'whisperTranscript',
            text:       event.delta,
            translated: '',
            interim:    true,
          });
        }
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = event.transcript;
        if (!transcript?.trim()) break;

        const translated = await translateText(transcript, sourceLang, targetLang);
        chrome.runtime.sendMessage({
          action:     'whisperTranscript',
          text:       transcript,
          translated: translated,
          interim:    false,
        });
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
    realtimeDc = null;
    realtimePc = null;
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

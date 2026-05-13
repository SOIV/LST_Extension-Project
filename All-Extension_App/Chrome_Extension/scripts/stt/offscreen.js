/**
 * LST - Offscreen Document (Tab Audio Capture + Whisper STT)
 *
 * 흐름:
 *   background → tabCaptureStream(streamId) → getUserMedia → AudioContext
 *                                            → MediaRecorder → Whisper API → translate → background
 *   background → tabCaptureStop             → 스트림 정리
 */

(function () {
  'use strict';

  // Whisper에 넘길 언어 코드 (ISO 639-1)
  const LANG_ISO = {
    'ko': 'ko', 'en': 'en', 'ja': 'ja',
    'zh-CN': 'zh', 'zh-TW': 'zh',
    'es': 'es', 'fr': 'fr', 'de': 'de', 'ru': 'ru',
  };

  let audioCtx     = null;
  let activeStream = null;
  let mediaRecorder = null;

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

    const { openaiApiKey, sourceLang, targetLang } =
      await chrome.storage.sync.get(['openaiApiKey', 'sourceLang', 'targetLang']);

    if (openaiApiKey) {
      startWhisperRecorder(stream, openaiApiKey, sourceLang || 'auto', targetLang || 'ko');
    } else {
      console.warn('[LST Offscreen] openaiApiKey not set — Whisper STT disabled');
    }

    console.log('[LST Offscreen] Tab audio capture started');
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

  /* ─── 캡처 중지 ───────────────────────────────────────────────────────────── */

  function stopCapture() {
    if (mediaRecorder?.state !== 'inactive') {
      mediaRecorder?.stop();
    }
    mediaRecorder = null;

    activeStream?.getTracks().forEach(t => t.stop());
    activeStream = null;

    audioCtx?.close().catch(() => {});
    audioCtx = null;

    console.log('[LST Offscreen] Tab audio capture stopped');
  }

  console.log('[LST Offscreen] Script loaded');
})();

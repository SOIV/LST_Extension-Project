/**
 * LST - Offscreen Document (Tab Audio Capture)
 * 탭 오디오 스트림을 수신하고 재생(음소거 방지) + STT 처리 준비
 *
 * 흐름:
 *   background → tabCaptureStream(streamId) → getUserMedia → AudioContext
 *   background → tabCaptureStop             → 스트림 정리
 *
 * NOTE: Web Speech API는 마이크 전용이므로 탭 오디오 STT는 외부 API 연동 필요.
 *       현재는 캡처 + 재생만 구현되어 있으며 STT 처리는 TODO 상태.
 */

(function () {
  'use strict';

  let audioCtx    = null;
  let activeStream = null;

  /* ─── 메시지 수신 (background → offscreen) ───────────────────────────── */

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

  /* ─── 캡처 시작 ──────────────────────────────────────────────────────── */

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

    // destination에 연결하여 탭 오디오가 음소거되지 않도록 유지
    source.connect(audioCtx.destination);

    // TODO: 외부 STT API 연동 시 아래 패턴으로 오디오 청크 전송
    // const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    // recorder.ondataavailable = (e) => { /* API endpoint로 전송 */ };
    // recorder.start(1000); // 1초 단위 청크

    console.log('[LST Offscreen] Tab audio capture started, streamId:', streamId);
  }

  /* ─── 캡처 중지 ──────────────────────────────────────────────────────── */

  function stopCapture() {
    activeStream?.getTracks().forEach(t => t.stop());
    activeStream = null;

    audioCtx?.close().catch(() => {});
    audioCtx = null;

    console.log('[LST Offscreen] Tab audio capture stopped');
  }

  console.log('[LST Offscreen] Script loaded');
})();

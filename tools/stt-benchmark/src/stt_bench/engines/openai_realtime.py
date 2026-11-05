"""OpenAI Realtime 전사 세션 — 익스텐션 'realtime' 엔진과 같은 세션 설정.

익스텐션은 WebRTC를 쓰지만, 여기서는 같은 전사 세션을 WebSocket으로 연다.
세션 설정은 offscreen.js getEphemeralToken()과 동일하게 turn_detection을 지정하지 않는다:
  - VAD 지원 모델(gpt-4o-transcribe 등): 기본 server_vad → 발화 턴마다 completed 이벤트
  - VAD 미지원 모델(gpt-realtime-whisper 등): commit이 없으므로 delta만 온다
    (익스텐션도 이 경우 delta를 모아 침묵 타이머로 확정 처리한다)

오디오는 실제 재생 속도로 보낸다. 프레임 i(길이 FRAME_MS)는 그 프레임 녹음이 끝나는
시점인 t0 + (i+1)*FRAME_MS에 전송되므로, "오디오 위치 p ms"의 벽시계 시각은 t0 + p로 본다.
"""

from __future__ import annotations

import asyncio
import base64
import json
import time
from dataclasses import dataclass, field

import numpy as np
from websockets.asyncio.client import connect

from stt_bench.audio import Audio, to_pcm16
from stt_bench.engines.base import Engine, EngineOutput

FRAME_MS = 100


@dataclass
class _Item:
    deltas: list[str] = field(default_factory=list)
    completed: str | None = None
    completed_ms: float | None = None
    audio_start_ms: float | None = None
    audio_end_ms: float | None = None


@dataclass
class _State:
    t0: float
    items: dict[str | None, _Item] = field(default_factory=dict)
    first_text_ms: float | None = None
    last_text_ms: float | None = None
    last_event_at: float = 0.0
    errors: list[str] = field(default_factory=list)
    event_counts: dict[str, int] = field(default_factory=dict)

    def item(self, item_id: str | None) -> _Item:
        return self.items.setdefault(item_id, _Item())

    def now_ms(self) -> float:
        return (time.perf_counter() - self.t0) * 1000


class OpenAIRealtimeEngine(Engine):
    kind = "realtime"
    modes = ("stream",)
    sample_rate = 24000

    def prepare(self) -> None:
        if not self.options.api_key:
            raise RuntimeError("OPENAI_API_KEY가 없습니다 (.env 또는 환경 변수)")
        base = self.options.base_url.rstrip("/")
        if base.startswith("https://"):
            base = "wss://" + base[len("https://"):]
        elif base.startswith("http://"):
            base = "ws://" + base[len("http://"):]
        self.ws_url = f"{base}/realtime?intent=transcription"

    def transcribe(self, audio: Audio, lang: str | None, speech: tuple[float, float] | None) -> EngineOutput:
        return asyncio.run(self._run(audio, lang, speech))

    def _session_update(self, lang: str | None) -> dict:
        transcription: dict = {"model": self.model}
        if lang:
            transcription["language"] = lang
        return {
            "type": "session.update",
            "session": {
                "type": "transcription",
                "audio": {
                    "input": {
                        "format": {"type": "audio/pcm", "rate": self.sample_rate},
                        "transcription": transcription,
                    },
                },
            },
        }

    async def _run(self, audio: Audio, lang: str | None, speech: tuple[float, float] | None) -> EngineOutput:
        headers = {"Authorization": f"Bearer {self.options.api_key}"}
        connect_started = time.perf_counter()
        async with connect(self.ws_url, additional_headers=headers, max_size=None, open_timeout=15) as ws:
            await ws.send(json.dumps(self._session_update(lang)))
            await self._wait_session_updated(ws)
            connect_ms = (time.perf_counter() - connect_started) * 1000

            state = _State(t0=time.perf_counter())
            state.last_event_at = state.t0
            receiver = asyncio.create_task(self._receive(ws, state))
            try:
                await self._stream(ws, audio, state)
                await self._wait_idle(state, receiver)
            finally:
                receiver.cancel()
                try:
                    await receiver
                except (asyncio.CancelledError, Exception):
                    pass

        return self._build_output(state, speech, connect_ms)

    async def _wait_session_updated(self, ws) -> None:
        async def wait():
            async for raw in ws:
                ev = json.loads(raw)
                if ev.get("type") == "session.updated":
                    return
                if ev.get("type") == "error":
                    raise RuntimeError(f"세션 설정 실패: {_error_message(ev)}")
            raise RuntimeError("세션 설정 전에 연결이 닫혔습니다")

        await asyncio.wait_for(wait(), timeout=15)

    async def _stream(self, ws, audio: Audio, state: _State) -> None:
        frame = int(self.sample_rate * FRAME_MS / 1000)
        tail = np.zeros(int(self.sample_rate * self.options.tail_silence_sec), dtype=np.float32)
        samples = np.concatenate([audio.samples, tail])
        for i, start in enumerate(range(0, len(samples), frame)):
            target = state.t0 + (i + 1) * FRAME_MS / 1000
            delay = target - time.perf_counter()
            if delay > 0:
                await asyncio.sleep(delay)
            pcm = to_pcm16(samples[start:start + frame])
            await ws.send(json.dumps({
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm).decode("ascii"),
            }))

    async def _receive(self, ws, state: _State) -> None:
        async for raw in ws:
            ev = json.loads(raw)
            etype = ev.get("type", "")
            now = state.now_ms()
            state.last_event_at = time.perf_counter()
            state.event_counts[etype] = state.event_counts.get(etype, 0) + 1
            item_id = ev.get("item_id")

            if etype == "conversation.item.input_audio_transcription.delta":
                delta = ev.get("delta") or ""
                state.item(item_id).deltas.append(delta)
                if delta.strip():
                    if state.first_text_ms is None:
                        state.first_text_ms = now
                    state.last_text_ms = now
            elif etype == "conversation.item.input_audio_transcription.completed":
                item = state.item(item_id)
                item.completed = ev.get("transcript") or ""
                item.completed_ms = now
                if item.completed.strip():
                    if state.first_text_ms is None:
                        state.first_text_ms = now
                    state.last_text_ms = now
            elif etype == "input_audio_buffer.speech_started":
                state.item(item_id).audio_start_ms = ev.get("audio_start_ms")
            elif etype == "input_audio_buffer.speech_stopped":
                state.item(item_id).audio_end_ms = ev.get("audio_end_ms")
            elif etype in ("error", "conversation.item.input_audio_transcription.failed"):
                state.errors.append(_error_message(ev))

    async def _wait_idle(self, state: _State, receiver: asyncio.Task) -> None:
        deadline = time.perf_counter() + self.options.max_wait_sec
        while time.perf_counter() < deadline and not receiver.done():
            if time.perf_counter() - state.last_event_at >= self.options.idle_sec:
                return
            await asyncio.sleep(0.1)

    def _build_output(self, state: _State, speech: tuple[float, float] | None, connect_ms: float) -> EngineOutput:
        texts = []
        for item in state.items.values():
            text = item.completed if item.completed is not None else "".join(item.deltas)
            if text.strip():
                texts.append(text.strip())
        delta_text = " ".join("".join(i.deltas).strip() for i in state.items.values() if i.deltas)
        text = " ".join(texts)

        if not text and state.errors:
            raise RuntimeError(state.errors[0])

        segment_lags = [
            i.completed_ms - i.audio_end_ms
            for i in state.items.values()
            if i.completed_ms is not None and i.audio_end_ms is not None
        ]
        first = tail = None
        if speech is not None:
            if state.first_text_ms is not None:
                first = state.first_text_ms - speech[0] * 1000
            if state.last_text_ms is not None:
                tail = state.last_text_ms - speech[1] * 1000

        extra: dict = {
            "connect_ms": connect_ms,
            "turns": sum(1 for i in state.items.values() if i.audio_end_ms is not None),
            "vad": any(i.audio_end_ms is not None for i in state.items.values()),
            "events": state.event_counts,
        }
        if delta_text and delta_text != text:
            extra["delta_text"] = delta_text
        if state.errors:
            extra["errors"] = state.errors
        return EngineOutput(
            text=text,
            first_text_lag_ms=first,
            tail_lag_ms=tail,
            segment_lag_ms=segment_lags,
            extra=extra,
        )


def _error_message(ev: dict) -> str:
    err = ev.get("error")
    if isinstance(err, dict):
        return err.get("message") or err.get("code") or json.dumps(err, ensure_ascii=False)
    return str(err or ev)

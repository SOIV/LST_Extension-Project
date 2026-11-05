import asyncio
import json

import httpx
import numpy as np
import pytest
from websockets.asyncio.server import serve

from stt_bench.audio import Audio
from stt_bench.engines import EngineOptions, create_engine, parse_spec
from stt_bench.engines.base import ChunkResult, chunk_timeline
from stt_bench.engines import openai_file
from stt_bench.engines.openai_file import OpenAIFileEngine
from stt_bench.engines.openai_realtime import OpenAIRealtimeEngine


def test_parse_spec_variants():
    assert parse_spec("openai:gpt-4o-mini-transcribe") == ("openai", "gpt-4o-mini-transcribe", None)
    assert parse_spec("local:large-v3:full") == ("local", "large-v3", "full")
    assert parse_spec(r"local:D:\models\ja-whisper") == ("local", r"D:\models\ja-whisper", None)
    assert parse_spec(r"local:D:\models\ja-whisper:full") == ("local", r"D:\models\ja-whisper", "full")
    with pytest.raises(ValueError):
        parse_spec("gemini:foo")
    with pytest.raises(ValueError):
        parse_spec("openai")


def test_engine_names_and_mode_validation():
    opts = EngineOptions(chunk_sec=3.0)
    assert create_engine("openai:gpt-4o-transcribe", opts).name == "openai:gpt-4o-transcribe@3s"
    assert create_engine("openai:gpt-4o-transcribe:full", opts).name == "openai:gpt-4o-transcribe@full"
    assert create_engine("realtime:gpt-realtime-whisper", opts).name == "realtime:gpt-realtime-whisper"
    with pytest.raises(ValueError):
        create_engine("realtime:gpt-realtime-whisper:full", opts)


def test_chunk_timeline_models_serial_queue():
    results = [
        ChunkResult(0.0, 3.0, "a", 500),
        ChunkResult(3.0, 6.0, "b", 4000),  # 청크 길이보다 오래 걸려 다음 청크가 밀림
        ChunkResult(6.0, 7.0, "c", 200),
    ]
    first, tail, seg = chunk_timeline(results, (0.5, 6.5))
    assert seg == [500, 4000, 3200]
    assert first == 3000  # 3.5s 도착 - 0.5s 발화 시작
    assert tail == 3700   # 10.2s 도착 - 6.5s 발화 끝


def test_chunk_timeline_skips_empty_chunks_for_first_text():
    results = [ChunkResult(0.0, 3.0, "", 100), ChunkResult(3.0, 6.0, "x", 100)]
    first, _, _ = chunk_timeline(results, (1.0, 5.0))
    assert first == 6100 - 1000


def _silence(seconds, rate):
    return Audio(np.zeros(int(seconds * rate), dtype=np.float32), rate)


def test_openai_file_engine_chunks_like_extension(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.read()
        calls.append(body)
        assert request.url.path == "/v1/audio/transcriptions"
        assert request.headers["Authorization"] == "Bearer test-key"
        assert b'name="model"' in body and b"gpt-4o-mini-transcribe" in body
        assert b'name="language"' in body and b"\r\n\r\nja\r\n" in body
        assert b"RIFF" in body  # wav 업로드
        if len(calls) == 2:
            return httpx.Response(429, json={"error": {"message": "rate limit"}})
        return httpx.Response(200, json={"text": f"t{len(calls)}"})

    monkeypatch.setattr(openai_file.time, "sleep", lambda _s: None)
    engine = OpenAIFileEngine(
        "gpt-4o-mini-transcribe", None,
        EngineOptions(api_key="test-key", chunk_sec=3.0),
        transport=httpx.MockTransport(handler),
    )
    engine.prepare()
    out = engine.transcribe(_silence(7.0, 16000), "ja", (0.0, 7.0))
    engine.close()

    assert len(calls) == 4  # 3청크 + 429 재시도 1회
    assert out.text == "t1 t3 t4"
    assert out.extra["retries"] == 1
    assert len(out.segment_lag_ms) == 3
    assert out.processing_sec is not None and out.tail_lag_ms is not None


def test_openai_file_engine_requires_key():
    with pytest.raises(RuntimeError):
        OpenAIFileEngine("whisper-1", None, EngineOptions(api_key=None)).prepare()


def _run_realtime(events_at: dict[int, list[dict]], seconds=0.5):
    """append 이벤트 n번째를 받았을 때 events_at[n]을 보내는 mock 서버로 엔진을 돌린다."""
    received = {"appends": 0}

    async def handler(ws):
        received["path"] = ws.request.path
        received["auth"] = ws.request.headers.get("Authorization")
        received["session"] = json.loads(await ws.recv())
        await ws.send(json.dumps({"type": "session.created"}))
        await ws.send(json.dumps({"type": "session.updated"}))
        async for raw in ws:
            if json.loads(raw)["type"] == "input_audio_buffer.append":
                received["appends"] += 1
                for ev in events_at.get(received["appends"], []):
                    await ws.send(json.dumps(ev))

    async def scenario():
        async with serve(handler, "127.0.0.1", 0) as server:
            port = server.sockets[0].getsockname()[1]
            engine = OpenAIRealtimeEngine(
                "gpt-test", None,
                EngineOptions(api_key="k", base_url=f"http://127.0.0.1:{port}/v1",
                              tail_silence_sec=0.2, idle_sec=0.4, max_wait_sec=5),
            )
            engine.prepare()
            return await engine._run(_silence(seconds, 24000), "ko", (0.1, 0.5))

    return asyncio.run(scenario()), received


def test_realtime_engine_vad_turns():
    out, received = _run_realtime({
        2: [{"type": "input_audio_buffer.speech_started", "item_id": "i1", "audio_start_ms": 100}],
        3: [{"type": "conversation.item.input_audio_transcription.delta", "item_id": "i1", "delta": "안녕"}],
        6: [
            {"type": "input_audio_buffer.speech_stopped", "item_id": "i1", "audio_end_ms": 500},
            {"type": "conversation.item.input_audio_transcription.completed", "item_id": "i1", "transcript": "안녕하세요"},
        ],
    })
    assert received["path"] == "/v1/realtime?intent=transcription"
    assert received["auth"] == "Bearer k"
    session = received["session"]["session"]
    assert received["session"]["type"] == "session.update"
    assert session["type"] == "transcription"
    assert session["audio"]["input"]["format"] == {"type": "audio/pcm", "rate": 24000}
    assert session["audio"]["input"]["transcription"] == {"model": "gpt-test", "language": "ko"}
    assert "turn_detection" not in session["audio"]["input"]  # 익스텐션과 동일하게 지정하지 않음
    assert received["appends"] == 7  # 0.5s 오디오 + 0.2s 무음, 100ms 프레임

    assert out.text == "안녕하세요"
    assert out.extra["vad"] is True and out.extra["turns"] == 1
    assert out.extra["delta_text"] == "안녕"
    assert len(out.segment_lag_ms) == 1 and out.segment_lag_ms[0] >= 0
    assert out.first_text_lag_ms is not None and out.tail_lag_ms is not None


def test_realtime_engine_delta_only_model():
    out, _ = _run_realtime({
        2: [{"type": "conversation.item.input_audio_transcription.delta", "item_id": "x", "delta": "こん"}],
        4: [{"type": "conversation.item.input_audio_transcription.delta", "item_id": "x", "delta": "にちは"}],
    })
    assert out.text == "こんにちは"
    assert out.extra["vad"] is False
    assert out.segment_lag_ms == []
    assert "delta_text" not in out.extra


def test_realtime_engine_raises_when_only_errors():
    with pytest.raises(RuntimeError, match="invalid model"):
        _run_realtime({1: [{"type": "error", "error": {"message": "invalid model"}}]})

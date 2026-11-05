"""OpenAI /v1/audio/transcriptions — 익스텐션 'whisper' 엔진과 같은 요청."""

from __future__ import annotations

import time

import httpx

from stt_bench.audio import Audio, split_chunks, to_wav_bytes
from stt_bench.engines.base import ChunkResult, Engine, EngineOutput, chunk_timeline

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_RETRIES = 3


class OpenAIFileEngine(Engine):
    kind = "openai"
    sample_rate = 16000

    def __init__(self, *args, transport: httpx.BaseTransport | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self._transport = transport  # 테스트용
        self._client: httpx.Client | None = None

    def prepare(self) -> None:
        if not self.options.api_key:
            raise RuntimeError("OPENAI_API_KEY가 없습니다 (.env 또는 환경 변수)")
        self._client = httpx.Client(
            base_url=self.options.base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {self.options.api_key}"},
            timeout=httpx.Timeout(120.0, connect=10.0),
            transport=self._transport,
        )

    def close(self) -> None:
        if self._client:
            self._client.close()

    def _request(self, wav: bytes, lang: str | None) -> tuple[str, float, int]:
        """(텍스트, 성공한 요청의 소요 ms, 재시도 횟수)"""
        if len(wav) > MAX_UPLOAD_BYTES:
            raise RuntimeError(f"업로드 한도(25MB) 초과: {len(wav) / 1024 / 1024:.1f}MB — 클립을 짧게 나누세요")
        data = {"model": self.model}
        if lang:
            data["language"] = lang
        assert self._client is not None
        for attempt in range(MAX_RETRIES + 1):
            started = time.perf_counter()
            res = self._client.post(
                "/audio/transcriptions",
                data=data,
                files={"file": ("audio.wav", wav, "audio/wav")},
            )
            elapsed_ms = (time.perf_counter() - started) * 1000
            if (res.status_code == 429 or res.status_code >= 500) and attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)
                continue
            if res.is_error:
                raise RuntimeError(f"{res.status_code}: {res.text[:300]}")
            return res.json().get("text", "") or "", elapsed_ms, attempt
        raise AssertionError("unreachable")

    def transcribe(self, audio: Audio, lang: str | None, speech: tuple[float, float] | None) -> EngineOutput:
        if self.mode == "full":
            text, ms, retries = self._request(to_wav_bytes(audio.samples, audio.rate), lang)
            return EngineOutput(text=text, processing_sec=ms / 1000, extra={"retries": retries})

        results: list[ChunkResult] = []
        retries = 0
        for chunk in split_chunks(audio, self.options.chunk_sec):
            text, ms, r = self._request(to_wav_bytes(chunk.samples, audio.rate), lang)
            retries += r
            results.append(ChunkResult(chunk.start_sec, chunk.end_sec, text, ms))

        first, tail, seg = chunk_timeline(results, speech)
        return EngineOutput(
            text=" ".join(r.text.strip() for r in results if r.text.strip()),
            first_text_lag_ms=first,
            tail_lag_ms=tail,
            segment_lag_ms=seg,
            processing_sec=sum(r.work_ms for r in results) / 1000,
            extra={"retries": retries, "chunks": [r.text for r in results]},
        )

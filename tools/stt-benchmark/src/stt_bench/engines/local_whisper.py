"""faster-whisper 로컬 추론 — Lite Helper 후보 엔진."""

from __future__ import annotations

import time

import numpy as np

from stt_bench.audio import Audio, split_chunks
from stt_bench.engines.base import ChunkResult, Engine, EngineOutput, chunk_timeline


class LocalWhisperEngine(Engine):
    kind = "local"
    sample_rate = 16000

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._model = None
        self.device = self.options.device

    @property
    def name(self) -> str:
        return f"{super().name}[{self.device}]"

    def prepare(self) -> None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise RuntimeError("faster-whisper가 설치되지 않았습니다: pip install -e \".[local]\"") from e

        try:
            self._load(WhisperModel, self.options.device)
        except RuntimeError as e:
            # auto는 GPU가 보이면 cuda를 고르지만, cuBLAS/cuDNN DLL이 없으면 여기서 실패한다
            if self.options.device != "auto" or not _is_cuda_runtime_error(e):
                raise
            print(f"  GPU를 쓸 수 없어 CPU로 실행합니다 ({e})")
            self._load(WhisperModel, "cpu")

    def _load(self, model_cls, device: str) -> None:
        self._model = model_cls(self.model, device=device, compute_type=self.options.compute_type)
        self.device = getattr(self._model.model, "device", device)
        # 첫 호출의 초기화 비용(CUDA 컨텍스트 등)을 측정에서 빼기 위한 워밍업
        self._run(np.zeros(self.sample_rate, dtype=np.float32), "en", previous_text=False)

    def _run(self, samples: np.ndarray, lang: str | None, previous_text: bool) -> tuple[str, float]:
        assert self._model is not None
        started = time.perf_counter()
        segments, _info = self._model.transcribe(
            samples,
            language=lang,
            beam_size=self.options.beam_size,
            vad_filter=False,
            condition_on_previous_text=previous_text,
        )
        text = " ".join(s.text.strip() for s in segments)  # segments는 제너레이터라 여기서 실제 추론이 돈다
        return text, (time.perf_counter() - started) * 1000

    def transcribe(self, audio: Audio, lang: str | None, speech: tuple[float, float] | None) -> EngineOutput:
        if self.mode == "full":
            text, ms = self._run(audio.samples, lang, previous_text=True)
            return EngineOutput(text=text, processing_sec=ms / 1000)

        results: list[ChunkResult] = []
        for chunk in split_chunks(audio, self.options.chunk_sec):
            text, ms = self._run(chunk.samples, lang, previous_text=False)
            results.append(ChunkResult(chunk.start_sec, chunk.end_sec, text, ms))

        first, tail, seg = chunk_timeline(results, speech)
        return EngineOutput(
            text=" ".join(r.text.strip() for r in results if r.text.strip()),
            first_text_lag_ms=first,
            tail_lag_ms=tail,
            segment_lag_ms=seg,
            processing_sec=sum(r.work_ms for r in results) / 1000,
            extra={"chunks": [r.text for r in results]},
        )


def _is_cuda_runtime_error(e: Exception) -> bool:
    msg = str(e).lower()
    return any(k in msg for k in ("cublas", "cudnn", "cuda"))

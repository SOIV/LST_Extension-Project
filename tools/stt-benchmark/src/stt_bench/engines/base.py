"""엔진 공통 인터페이스와 청크 방식 지연 계산."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from stt_bench.audio import Audio


@dataclass
class EngineOptions:
    api_key: str | None = None
    base_url: str = "https://api.openai.com/v1"
    chunk_sec: float = 3.0
    device: str = "auto"
    compute_type: str = "auto"
    beam_size: int = 5
    # Realtime 스트리밍: 오디오 뒤에 붙이는 무음 길이, 이벤트가 끊긴 뒤 기다리는 시간
    tail_silence_sec: float = 2.0
    idle_sec: float = 3.0
    max_wait_sec: float = 30.0


@dataclass
class EngineOutput:
    text: str
    # 첫 발화 시작 → 첫 텍스트 도착(ms)
    first_text_lag_ms: float | None = None
    # 마지막 발화 끝 → 마지막 텍스트 도착(ms)
    tail_lag_ms: float | None = None
    # 구간(청크/발화 턴) 끝 → 그 구간 확정 텍스트 도착(ms)
    segment_lag_ms: list[float] = field(default_factory=list)
    # 순수 처리/요청 시간 합(초). RTF = processing_sec / 오디오 길이
    processing_sec: float | None = None
    extra: dict = field(default_factory=dict)


class Engine(ABC):
    kind: str = ""
    modes: tuple[str, ...] = ("chunk", "full")
    sample_rate: int = 16000

    def __init__(self, model: str, mode: str | None, options: EngineOptions):
        self.model = model
        self.mode = mode or self.modes[0]
        if self.mode not in self.modes:
            raise ValueError(f"{self.kind} 엔진은 {', '.join(self.modes)} 모드만 지원합니다: {self.mode}")
        self.options = options

    @property
    def name(self) -> str:
        if self.mode == "chunk":
            return f"{self.kind}:{self.model}@{self.options.chunk_sec:g}s"
        if self.mode == "full":
            return f"{self.kind}:{self.model}@full"
        return f"{self.kind}:{self.model}"

    def prepare(self) -> None:
        """모델 로딩, API 키 확인 등 클립과 무관한 준비. 시간 측정에서 제외된다."""

    @abstractmethod
    def transcribe(self, audio: Audio, lang: str | None, speech: tuple[float, float] | None) -> EngineOutput:
        """lang은 ISO 코드(None이면 자동 감지), speech는 (첫 발화 시작, 마지막 발화 끝) 초."""

    def close(self) -> None:
        pass


@dataclass
class ChunkResult:
    start_sec: float
    end_sec: float
    text: str
    work_ms: float  # 요청/추론에 걸린 시간


def chunk_timeline(
    results: list[ChunkResult],
    speech: tuple[float, float] | None,
) -> tuple[float | None, float | None, list[float]]:
    """익스텐션 Whisper 경로를 그대로 재현해 지연을 계산한다.

    녹음은 끊기지 않고 계속되고, 각 청크는 녹음이 끝난 시점부터 직렬 큐로 처리된다
    (offscreen.js의 processingQueue). 처리 시간이 청크 길이보다 길면 큐가 밀린다.
    """
    finishes: list[float] = []
    prev_finish = 0.0
    for r in results:
        finish = max(r.end_sec * 1000, prev_finish) + r.work_ms
        finishes.append(finish)
        prev_finish = finish

    segment_lags = [f - r.end_sec * 1000 for f, r in zip(finishes, results)]
    if speech is None:
        return None, None, segment_lags

    onset_ms, offset_ms = speech[0] * 1000, speech[1] * 1000
    first = next(
        (f - onset_ms for f, r in zip(finishes, results) if r.end_sec * 1000 > onset_ms and r.text.strip()),
        None,
    )
    tail = None
    for f, r in zip(finishes, results):
        if r.start_sec * 1000 <= offset_ms:
            tail = f - offset_ms
    return first, tail, segment_lags

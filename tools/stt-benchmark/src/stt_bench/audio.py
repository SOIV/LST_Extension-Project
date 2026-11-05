"""오디오 디코딩, 청크 분할, 발화 구간 추정."""

from __future__ import annotations

import io
import wave
from dataclasses import dataclass
from pathlib import Path

import av
import numpy as np


@dataclass
class Audio:
    samples: np.ndarray  # float32 mono, [-1, 1]
    rate: int

    @property
    def duration_sec(self) -> float:
        return len(self.samples) / self.rate


@dataclass
class Chunk:
    start_sec: float
    end_sec: float
    samples: np.ndarray


def load_audio(path: Path, rate: int) -> Audio:
    """어떤 컨테이너든(wav/mp3/m4a/webm/mp4 …) mono PCM으로 디코딩해 rate로 리샘플링한다."""
    parts: list[np.ndarray] = []
    with av.open(str(path)) as container:
        if not container.streams.audio:
            raise ValueError(f"오디오 스트림이 없습니다: {path}")
        stream = container.streams.audio[0]
        resampler = av.AudioResampler(format="s16", layout="mono", rate=rate)
        for frame in container.decode(stream):
            for out in resampler.resample(frame):
                parts.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):
            parts.append(out.to_ndarray().reshape(-1))

    pcm = np.concatenate(parts) if parts else np.zeros(0, dtype=np.int16)
    return Audio(samples=pcm.astype(np.float32) / 32768.0, rate=rate)


def to_pcm16(samples: np.ndarray) -> bytes:
    return (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2").tobytes()


def to_wav_bytes(samples: np.ndarray, rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(to_pcm16(samples))
    return buf.getvalue()


def split_chunks(audio: Audio, chunk_sec: float, min_sec: float = 0.3) -> list[Chunk]:
    """익스텐션 Whisper 경로처럼 고정 길이로 자른다. 너무 짧은 마지막 조각은 버린다."""
    size = max(1, int(round(chunk_sec * audio.rate)))
    chunks: list[Chunk] = []
    for start in range(0, len(audio.samples), size):
        piece = audio.samples[start:start + size]
        if len(piece) < min_sec * audio.rate:
            continue
        chunks.append(Chunk(start / audio.rate, (start + len(piece)) / audio.rate, piece))
    return chunks


def speech_bounds(
    audio: Audio,
    frame_ms: int = 30,
    rel_db: float = 35.0,
    floor_db: float = -50.0,
) -> tuple[float, float] | None:
    """에너지 기준으로 첫 발화 시작/마지막 발화 끝(초)을 추정한다.

    배경음이 큰 클립에서는 부정확하므로, 정답 자막에 타임코드(.srt/.vtt)가 있으면 그쪽을 우선한다.
    """
    n = int(audio.rate * frame_ms / 1000)
    frames = len(audio.samples) // n if n else 0
    if frames == 0:
        return None
    x = audio.samples[:frames * n].reshape(frames, n).astype(np.float64)
    db = 20 * np.log10(np.sqrt(np.mean(x * x, axis=1)) + 1e-12)
    threshold = max(floor_db, float(db.max()) - rel_db)
    voiced = np.flatnonzero(db > threshold)
    if voiced.size == 0:
        return None
    return voiced[0] * frame_ms / 1000, (voiced[-1] + 1) * frame_ms / 1000

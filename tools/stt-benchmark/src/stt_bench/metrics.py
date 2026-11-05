"""정확도(CER/WER)와 지연 통계."""

from __future__ import annotations

import unicodedata
from dataclasses import asdict, dataclass

import jiwer
import numpy as np

# WER을 함께 보는 언어(띄어쓰기로 단어가 나뉘는 언어). ko/ja/zh는 CER만 본다.
WER_LANGS = {"en", "es", "fr", "de", "ru"}


def normalize_text(text: str) -> str:
    """NFKC + 소문자화 + 문장부호/기호 제거 + 공백 정리.

    전각/반각 차이, 문장부호, 대소문자 차이는 오류로 세지 않는다.
    한자/가나 표기 차이(例: 今日 ↔ きょう)나 숫자 표기 차이(3 ↔ 三)는 그대로 오류로 잡힌다.
    """
    t = unicodedata.normalize("NFKC", text).casefold()
    t = "".join(" " if unicodedata.category(ch)[0] in "PSZC" else ch for ch in t)
    return " ".join(t.split())


@dataclass
class ErrorCounts:
    ref_len: int = 0
    hits: int = 0
    substitutions: int = 0
    deletions: int = 0
    insertions: int = 0

    @property
    def errors(self) -> int:
        return self.substitutions + self.deletions + self.insertions

    @property
    def rate(self) -> float | None:
        return self.errors / self.ref_len if self.ref_len else None

    def __add__(self, other: "ErrorCounts") -> "ErrorCounts":
        return ErrorCounts(
            self.ref_len + other.ref_len,
            self.hits + other.hits,
            self.substitutions + other.substitutions,
            self.deletions + other.deletions,
            self.insertions + other.insertions,
        )

    def to_dict(self) -> dict:
        return asdict(self)


def _counts(ref_len: int, out) -> ErrorCounts:
    return ErrorCounts(ref_len, out.hits, out.substitutions, out.deletions, out.insertions)


def char_errors(reference: str, hypothesis: str) -> ErrorCounts:
    """공백을 뺀 글자 단위 편집 거리."""
    r = normalize_text(reference).replace(" ", "")
    h = normalize_text(hypothesis).replace(" ", "")
    if not r:
        return ErrorCounts(insertions=len(h))
    if not h:
        return ErrorCounts(ref_len=len(r), deletions=len(r))
    return _counts(len(r), jiwer.process_characters(r, h))


def word_errors(reference: str, hypothesis: str) -> ErrorCounts:
    r = normalize_text(reference)
    h = normalize_text(hypothesis)
    rw, hw = r.split(), h.split()
    if not rw:
        return ErrorCounts(insertions=len(hw))
    if not hw:
        return ErrorCounts(ref_len=len(rw), deletions=len(rw))
    return _counts(len(rw), jiwer.process_words(r, h))


def summarize(values: list[float | None]) -> dict | None:
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    arr = np.asarray(vals, dtype=np.float64)
    return {
        "n": int(arr.size),
        "mean": float(arr.mean()),
        "p50": float(np.percentile(arr, 50)),
        "p95": float(np.percentile(arr, 95)),
        "max": float(arr.max()),
    }

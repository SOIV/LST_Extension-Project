"""데이터셋 탐색과 정답 텍스트 로딩.

구조:
    datasets/<언어>/<아무 하위 폴더>/<클립>.<오디오 확장자>
    datasets/<언어>/<아무 하위 폴더>/<클립>.txt | .srt | .vtt   (정답)

언어는 datasets 바로 아래 폴더 이름(ko, ja, en …)으로 정한다.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from pathlib import Path

AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".webm", ".mp4", ".mkv"}
REF_EXTS = (".txt", ".srt", ".vtt")

# 익스텐션 offscreen.js의 LANG_ISO와 동일한 매핑
LANG_ISO = {
    "ko": "ko", "en": "en", "ja": "ja",
    "zh-CN": "zh", "zh-TW": "zh",
    "es": "es", "fr": "fr", "de": "de", "ru": "ru",
}

_TIME = r"(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})"
_CUE_TIMING = re.compile(_TIME + r"\s*-->\s*" + _TIME)
_TAG = re.compile(r"<[^>]*>|\{\\[^}]*\}")


@dataclass
class Reference:
    text: str
    speech_start: float | None = None  # 자막 타임코드 기준 첫 발화 시작(초)
    speech_end: float | None = None    # 자막 타임코드 기준 마지막 발화 끝(초)
    source: str = "txt"


@dataclass
class Clip:
    id: str          # datasets 기준 상대 경로(확장자 제외)
    lang: str        # 폴더 이름 그대로 (ko, ja, zh-CN …)
    audio_path: Path
    ref: Reference

    @property
    def iso_lang(self) -> str | None:
        return LANG_ISO.get(self.lang, self.lang or None)


def _to_sec(h: str | None, m: str, s: str, ms: str) -> float:
    return int(h or 0) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse_timed_text(content: str) -> Reference:
    """SRT/VTT에서 텍스트만 뽑고, 첫 큐 시작/마지막 큐 끝을 함께 돌려준다."""
    texts: list[str] = []
    starts: list[float] = []
    ends: list[float] = []
    in_cue = False
    # \r\r\n은 Windows 텍스트 모드로 CRLF를 한 번 더 변환한 깨진 파일에서 흔히 보인다
    for raw in content.replace("\r\r\n", "\n").replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw.strip()
        m = _CUE_TIMING.search(line)
        if m:
            g = m.groups()
            starts.append(_to_sec(*g[0:4]))
            ends.append(_to_sec(*g[4:8]))
            in_cue = True
            continue
        if not line:
            in_cue = False
            continue
        if in_cue:  # 큐 번호, WEBVTT 헤더, NOTE/STYLE 블록은 타이밍 줄 앞에 있으므로 자연히 제외된다
            text = html.unescape(_TAG.sub("", line)).strip()
            if text:
                texts.append(text)
    return Reference(
        text=" ".join(texts),
        speech_start=min(starts) if starts else None,
        speech_end=max(ends) if ends else None,
    )


def load_reference(path: Path) -> Reference:
    content = path.read_text(encoding="utf-8-sig")
    ext = path.suffix.lower()
    if ext in (".srt", ".vtt"):
        ref = parse_timed_text(content)
        ref.source = ext[1:]
        return ref
    return Reference(text=" ".join(content.split()), source="txt")


def discover(root: Path, langs: list[str] | None = None) -> tuple[list[Clip], list[str]]:
    """클립 목록과 경고 메시지(정답 없는 오디오 등)를 돌려준다."""
    clips: list[Clip] = []
    warnings: list[str] = []
    if not root.is_dir():
        raise FileNotFoundError(f"데이터셋 폴더가 없습니다: {root}")

    for audio_path in sorted(p for p in root.rglob("*") if p.suffix.lower() in AUDIO_EXTS):
        rel = audio_path.relative_to(root)
        if len(rel.parts) < 2:
            warnings.append(f"언어 폴더 밖에 있어 건너뜀: {rel.as_posix()}")
            continue
        lang = rel.parts[0]
        if langs and lang not in langs:
            continue
        ref_path = next(
            (audio_path.with_suffix(ext) for ext in REF_EXTS if audio_path.with_suffix(ext).is_file()),
            None,
        )
        if ref_path is None:
            warnings.append(f"정답 파일(.txt/.srt/.vtt) 없음: {rel.as_posix()}")
            continue
        ref = load_reference(ref_path)
        if not ref.text:
            warnings.append(f"정답 텍스트가 비어 있음: {ref_path.relative_to(root).as_posix()}")
            continue
        clips.append(Clip(rel.with_suffix("").as_posix(), lang, audio_path, ref))
    return clips, warnings

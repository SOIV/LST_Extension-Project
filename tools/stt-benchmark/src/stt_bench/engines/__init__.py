"""엔진 스펙 파싱과 생성.

스펙 형식: kind:model[:mode]
    openai:gpt-4o-mini-transcribe        3초 청크 (익스텐션 whisper 경로)
    openai:gpt-4o-transcribe:full        파일 통째로 (정확도 상한선)
    realtime:gpt-realtime-whisper        실시간 스트리밍 (익스텐션 realtime 경로)
    local:small                          faster-whisper 3초 청크
    local:large-v3:full                  faster-whisper 파일 통째로
"""

from __future__ import annotations

from stt_bench.engines.base import Engine, EngineOptions, EngineOutput

KINDS = ("openai", "realtime", "local")
MODES = ("chunk", "full", "stream")


def parse_spec(spec: str) -> tuple[str, str, str | None]:
    kind, sep, rest = spec.partition(":")
    if not sep or not rest:
        raise ValueError(f"엔진 스펙은 kind:model[:mode] 형식입니다: {spec!r}")
    if kind not in KINDS:
        raise ValueError(f"알 수 없는 엔진 종류 {kind!r} (가능: {', '.join(KINDS)})")
    mode = None
    head, sep, tail = rest.rpartition(":")
    if sep and tail in MODES:  # 모델 경로에 드라이브 문자(D:\...)가 있어도 마지막 토큰만 모드로 본다
        rest, mode = head, tail
    return kind, rest, mode


def create_engine(spec: str, options: EngineOptions) -> Engine:
    kind, model, mode = parse_spec(spec)
    if kind == "openai":
        from stt_bench.engines.openai_file import OpenAIFileEngine
        return OpenAIFileEngine(model, mode, options)
    if kind == "realtime":
        from stt_bench.engines.openai_realtime import OpenAIRealtimeEngine
        return OpenAIRealtimeEngine(model, mode, options)
    from stt_bench.engines.local_whisper import LocalWhisperEngine
    return LocalWhisperEngine(model, mode, options)


__all__ = ["Engine", "EngineOptions", "EngineOutput", "create_engine", "parse_spec"]

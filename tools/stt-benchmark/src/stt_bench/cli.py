"""명령행 진입점: stt-bench run / stt-bench report"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

from stt_bench.audio import Audio, load_audio, speech_bounds
from stt_bench.dataset import Clip, discover
from stt_bench.engines import Engine, EngineOptions, EngineOutput, create_engine
from stt_bench.metrics import WER_LANGS, char_errors, word_errors
from stt_bench.report import load_records, summarize_groups, write_report


def load_env_file(path: Path) -> None:
    """KEY=VALUE 형식의 .env를 읽어 아직 없는 환경 변수만 채운다."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        os.environ.setdefault(key, value.strip().strip('"').strip("'"))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="stt-bench", description="LST STT 엔진 정확도/지연 벤치마크")
    sub = parser.add_subparsers(dest="cmd", required=True)

    run = sub.add_parser("run", help="벤치마크 실행")
    run.add_argument("-e", "--engine", action="append", required=True, metavar="KIND:MODEL[:MODE]",
                     help="예: openai:gpt-4o-mini-transcribe, realtime:gpt-realtime-whisper, local:small:full (여러 번 지정)")
    run.add_argument("--dataset", type=Path, default=Path("datasets"), help="데이터셋 폴더 (기본: datasets)")
    run.add_argument("--lang", action="append", help="이 언어 폴더만 실행 (여러 번 지정 가능)")
    run.add_argument("--limit", type=int, help="앞에서부터 N개 클립만")
    run.add_argument("--out", type=Path, default=Path("results"), help="결과 폴더 (기본: results)")
    run.add_argument("--chunk-sec", type=float, default=3.0, help="청크 길이(초), 익스텐션 기본값 3")
    run.add_argument("--auto-lang", action="store_true", help="언어 힌트 없이 자동 감지 (익스텐션 sourceLang=auto)")
    run.add_argument("--device", default="auto", help="로컬 엔진 장치: auto | cpu | cuda")
    run.add_argument("--compute-type", default="auto", help="로컬 엔진 연산 정밀도: auto | int8 | float16 …")
    run.add_argument("--beam-size", type=int, default=5, help="로컬 엔진 beam size")
    run.add_argument("--env-file", type=Path, default=Path(".env"), help="API 키를 읽을 .env 경로")
    run.add_argument("--openai-base-url", default=None, help="기본: OPENAI_BASE_URL 또는 https://api.openai.com/v1")

    rep = sub.add_parser("report", help="results.jsonl로 리포트 다시 만들기")
    rep.add_argument("path", type=Path, help="결과 폴더 또는 results.jsonl")
    return parser


def resolve_speech(clip: Clip, audio16: Audio) -> tuple[tuple[float, float] | None, str | None]:
    ref = clip.ref
    if ref.speech_start is not None and ref.speech_end is not None and ref.speech_end <= audio16.duration_sec + 1.0:
        return (ref.speech_start, ref.speech_end), ref.source
    bounds = speech_bounds(audio16)
    return bounds, ("energy" if bounds else None)


def build_record(clip: Clip, engine: Engine, audio_sec: float, speech, speech_source,
                 out: EngineOutput | None, error: str | None, wall_sec: float) -> dict:
    record: dict = {
        "clip": clip.id,
        "lang": clip.lang,
        "engine": engine.name,
        "audio_sec": round(audio_sec, 3),
        "speech": list(speech) if speech else None,
        "speech_source": speech_source,
        "ref": clip.ref.text,
        "error": error,
        "wall_sec": round(wall_sec, 3),
    }
    if out is None:
        return record
    cer = char_errors(clip.ref.text, out.text)
    record.update({
        "hyp": out.text,
        "cer": cer.to_dict(),
        "cer_rate": cer.rate,
        "wer": word_errors(clip.ref.text, out.text).to_dict() if clip.lang in WER_LANGS else None,
        "first_text_lag_ms": out.first_text_lag_ms,
        "tail_lag_ms": out.tail_lag_ms,
        "segment_lag_ms": out.segment_lag_ms,
        "processing_sec": out.processing_sec,
        "rtf": out.processing_sec / audio_sec if out.processing_sec is not None and audio_sec else None,
        "extra": out.extra,
    })
    return record


def cmd_run(args: argparse.Namespace) -> int:
    load_env_file(args.env_file)
    try:
        clips, warnings = discover(args.dataset, args.lang)
    except FileNotFoundError as e:
        print(f"오류: {e}", file=sys.stderr)
        return 2
    for w in warnings:
        print(f"경고: {w}")
    if args.limit:
        clips = clips[:args.limit]
    if not clips:
        print("실행할 클립이 없습니다. README의 데이터셋 구조를 확인하세요.", file=sys.stderr)
        return 1

    options = EngineOptions(
        api_key=os.environ.get("OPENAI_API_KEY"),
        base_url=args.openai_base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1",
        chunk_sec=args.chunk_sec,
        device=args.device,
        compute_type=args.compute_type,
        beam_size=args.beam_size,
    )
    try:
        engines = [create_engine(spec, options) for spec in args.engine]
    except ValueError as e:
        print(f"오류: {e}", file=sys.stderr)
        return 2

    for engine in engines:
        print(f"준비 중: {engine.name}")
        try:
            engine.prepare()
        except Exception as e:
            print(f"오류: {engine.name} 준비 실패 — {e}", file=sys.stderr)
            for e2 in engines:
                e2.close()
            return 2

    out_dir = args.out / datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    run_info = {
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "dataset": str(args.dataset),
        "clip_count": len(clips),
        "engines": [e.name for e in engines],
        "chunk_sec": args.chunk_sec,
        "auto_lang": args.auto_lang,
        "device": args.device,
        "beam_size": args.beam_size,
    }
    (out_dir / "run.json").write_text(json.dumps(run_info, ensure_ascii=False, indent=2), encoding="utf-8")

    total = len(clips) * len(engines)
    done = 0
    langs = sorted({c.lang for c in clips})
    audio_note = ", ".join(f"{lang} {sum(1 for c in clips if c.lang == lang)}개" for lang in langs)
    print(f"클립 {len(clips)}개 ({audio_note}) × 엔진 {len(engines)}개 → {out_dir}")

    try:
        with (out_dir / "results.jsonl").open("w", encoding="utf-8") as f:
            for clip in clips:
                cache: dict[int, Audio] = {}
                try:
                    cache[16000] = load_audio(clip.audio_path, 16000)
                except Exception as e:
                    print(f"  {clip.id}: 오디오 디코딩 실패 — {e}")
                    done += len(engines)
                    continue
                speech, speech_source = resolve_speech(clip, cache[16000])

                for engine in engines:
                    done += 1
                    if engine.sample_rate not in cache:
                        cache[engine.sample_rate] = load_audio(clip.audio_path, engine.sample_rate)
                    audio = cache[engine.sample_rate]
                    lang = None if args.auto_lang else clip.iso_lang

                    started = time.perf_counter()
                    out, error = None, None
                    try:
                        out = engine.transcribe(audio, lang, speech)
                    except KeyboardInterrupt:
                        raise
                    except Exception as e:
                        error = f"{type(e).__name__}: {e}"
                    wall = time.perf_counter() - started

                    record = build_record(clip, engine, audio.duration_sec, speech, speech_source, out, error, wall)
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    f.flush()
                    print(f"[{done}/{total}] {clip.id} · {engine.name} · {_progress_note(record)}")
    except KeyboardInterrupt:
        print("\n중단됨 — 지금까지의 결과로 리포트를 만듭니다.")
    finally:
        for engine in engines:
            engine.close()

    report_path = write_report(out_dir)
    print()
    print(_console_summary(load_records(out_dir / "results.jsonl")))
    print(f"리포트: {report_path}")
    return 0


def _progress_note(record: dict) -> str:
    if record.get("error"):
        return f"오류 {record['error'][:160]}"
    parts = [f"CER {record['cer_rate'] * 100:.1f}%" if record.get("cer_rate") is not None else "CER -"]
    if record.get("tail_lag_ms") is not None:
        parts.append(f"마지막 발화→텍스트 {record['tail_lag_ms'] / 1000:.2f}s")
    if record.get("rtf") is not None:
        parts.append(f"RTF {record['rtf']:.2f}")
    return " · ".join(parts)


def _console_summary(records: list[dict]) -> str:
    lines = ["언어  CER      엔진"]
    for r in summarize_groups(records):
        cer = "-" if r["cer"] is None else f"{r['cer'] * 100:5.1f}%"
        lines.append(f"{r['lang']:<5} {cer:<8} {r['engine']}" + (f"  (오류 {r['errors']})" if r["errors"] else ""))
    return "\n".join(lines)


def cmd_report(args: argparse.Namespace) -> int:
    path = args.path
    out_dir = path.parent if path.is_file() else path
    if not (out_dir / "results.jsonl").is_file():
        print(f"오류: results.jsonl이 없습니다: {out_dir}", file=sys.stderr)
        return 2
    print(f"리포트: {write_report(out_dir)}")
    return 0


def main(argv: list[str] | None = None) -> int:
    # 파이프/리다이렉트 시에도 진행 로그가 바로 보이게 하고, 콘솔이 아니면 UTF-8로 내보낸다
    # (콘솔에서는 Python이 유니코드로 직접 출력하므로 그대로 둔다)
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            if stream.isatty():
                stream.reconfigure(line_buffering=True)
            else:
                stream.reconfigure(line_buffering=True, encoding="utf-8", errors="backslashreplace")
    args = build_parser().parse_args(argv)
    if args.cmd == "run":
        return cmd_run(args)
    return cmd_report(args)

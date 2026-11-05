"""results.jsonl → report.md / summary.json."""

from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path

from stt_bench.metrics import WER_LANGS, ErrorCounts, summarize

TEXT_PREVIEW_CHARS = 1000


def load_records(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def _pct(x: float | None) -> str:
    return "-" if x is None else f"{x * 100:.1f}%"


def _sec(ms: float | None) -> str:
    return "-" if ms is None else f"{ms / 1000:.2f}s"


def _pair(stats: dict | None) -> str:
    return "-" if not stats else f"{_sec(stats['p50'])} / {_sec(stats['p95'])}"


def _counts(d: dict | None) -> ErrorCounts:
    return ErrorCounts(**d) if d else ErrorCounts()


def summarize_groups(records: list[dict]) -> list[dict]:
    groups: OrderedDict[tuple[str, str], list[dict]] = OrderedDict()
    for r in records:
        groups.setdefault((r["lang"], r["engine"]), []).append(r)

    rows = []
    for (lang, engine), recs in groups.items():
        ok = [r for r in recs if not r.get("error")]
        cer = sum((_counts(r.get("cer")) for r in ok), ErrorCounts())
        wer = sum((_counts(r.get("wer")) for r in ok), ErrorCounts()) if lang in WER_LANGS else None
        audio_sec = sum(r["audio_sec"] for r in ok)
        processing = [r["processing_sec"] for r in ok if r.get("processing_sec") is not None]
        rows.append({
            "lang": lang,
            "engine": engine,
            "clips": len(recs),
            "ok": len(ok),
            "errors": len(recs) - len(ok),
            "audio_sec": audio_sec,
            "cer": cer.rate,
            "cer_counts": cer.to_dict(),
            "wer": wer.rate if wer else None,
            "first_text_lag": summarize([r.get("first_text_lag_ms") for r in ok]),
            "tail_lag": summarize([r.get("tail_lag_ms") for r in ok]),
            "segment_lag": summarize([v for r in ok for v in r.get("segment_lag_ms") or []]),
            # 처리 시간이 있는 클립 기준 RTF (스트리밍 엔진은 해당 없음)
            "rtf": (sum(processing) / sum(r["audio_sec"] for r in ok if r.get("processing_sec") is not None))
            if processing else None,
        })
    return rows


def _sdi(c: dict) -> str:
    n = c["ref_len"]
    if not n:
        return "-"
    return f"{c['substitutions'] / n * 100:.1f} / {c['deletions'] / n * 100:.1f} / {c['insertions'] / n * 100:.1f}"


def render_markdown(records: list[dict], run_info: dict | None) -> str:
    rows = summarize_groups(records)
    lines: list[str] = ["# STT 벤치마크 결과", ""]

    if run_info:
        lines += ["| 항목 | 값 |", "|---|---|"]
        for key, label in [
            ("started_at", "실행 시각"),
            ("dataset", "데이터셋"),
            ("clip_count", "클립 수"),
            ("chunk_sec", "청크 길이(초)"),
            ("auto_lang", "언어 자동 감지"),
            ("device", "로컬 장치"),
            ("beam_size", "로컬 beam size"),
        ]:
            if key in run_info:
                lines.append(f"| {label} | {run_info[key]} |")
        lines.append("")

    lines += [
        "## 요약",
        "",
        "| 언어 | 엔진 | 클립 | 오디오 | CER | S / D / I (%) | WER | 첫 텍스트 p50 | 마지막 발화→텍스트 p50 / p95 | 구간 끝→확정 p50 / p95 | RTF | 오류 |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in rows:
        ft = r["first_text_lag"]
        lines.append(
            f"| {r['lang']} | `{r['engine']}` | {r['ok']}/{r['clips']} | {r['audio_sec']:.0f}s | "
            f"{_pct(r['cer'])} | {_sdi(r['cer_counts'])} | {_pct(r['wer'])} | "
            f"{_sec(ft['p50']) if ft else '-'} | {_pair(r['tail_lag'])} | {_pair(r['segment_lag'])} | "
            f"{'-' if r['rtf'] is None else format(r['rtf'], '.2f')} | {r['errors']} |"
        )

    lines += [
        "",
        "### 지표 설명",
        "",
        "- **CER**: 문장부호·공백·대소문자·전각/반각을 정규화한 뒤 글자 단위 오류율. 클립을 합쳐서 계산(마이크로 평균).",
        "- **S / D / I**: 대치 / 삭제(놓친 글자) / 삽입(없는 말을 만든 글자) 비율. 삽입이 높으면 환각(예: 무음 구간의 \"ご視聴ありがとうございました\")을 의심.",
        "- **WER**: 띄어쓰기 언어(en/es/fr/de/ru)만 계산.",
        "- **첫 텍스트**: 첫 발화 시작 → 첫 텍스트가 화면에 뜰 수 있는 시점.",
        "- **마지막 발화→텍스트**: 마지막 발화가 끝난 뒤 그 말이 텍스트로 도착하기까지. 클립당 1개 값.",
        "- **구간 끝→확정**: 청크 엔진은 청크 녹음 끝 → 결과 도착(큐 대기 포함), Realtime VAD 모델은 발화 턴 끝 → completed.",
        "- **RTF**: 처리 시간 / 오디오 길이. 청크 엔진은 1 미만이어야 큐가 밀리지 않는다.",
        "- 청크 엔진의 지연은 익스텐션처럼 녹음과 처리가 동시에 돌고 처리는 직렬 큐라고 보고 계산한 값이다.",
        "- VAD 미지원 Realtime 모델(gpt-realtime-whisper 등)은 delta만 오므로, 익스텐션에서 확정 표시는 여기에 침묵 감지 시간(기본 1.5s)이 더해진다.",
        "",
        "## 클립별",
        "",
        "| 클립 | 엔진 | CER | 첫 텍스트 | 마지막 발화→텍스트 | 발화 구간 기준 | 비고 |",
        "|---|---|---:|---:|---:|---|---|",
    ]
    for r in records:
        note = r.get("error") or ""
        if not note and r.get("extra", {}).get("errors"):
            note = "API 오류 이벤트: " + "; ".join(r["extra"]["errors"])[:120]
        cer = _counts(r.get("cer")).rate if not r.get("error") else None
        lines.append(
            f"| {r['clip']} | `{r['engine']}` | {_pct(cer)} | {_sec(r.get('first_text_lag_ms'))} | "
            f"{_sec(r.get('tail_lag_ms'))} | {r.get('speech_source') or '-'} | {note.replace('|', '/')} |"
        )

    lines += ["", "## 텍스트 비교", ""]
    by_clip: OrderedDict[str, list[dict]] = OrderedDict()
    for r in records:
        by_clip.setdefault(r["clip"], []).append(r)
    for clip, recs in by_clip.items():
        lines += [f"<details><summary>{clip}</summary>", "", f"- **정답**: {_preview(recs[0]['ref'])}"]
        for r in recs:
            body = r.get("error") or _preview(r.get("hyp") or "")
            lines.append(f"- **`{r['engine']}`**: {body}")
        lines += ["", "</details>", ""]

    return "\n".join(lines) + "\n"


def _preview(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= TEXT_PREVIEW_CHARS else text[:TEXT_PREVIEW_CHARS] + " …"


def write_report(out_dir: Path) -> Path:
    records = load_records(out_dir / "results.jsonl")
    run_path = out_dir / "run.json"
    run_info = json.loads(run_path.read_text(encoding="utf-8")) if run_path.is_file() else None
    report_path = out_dir / "report.md"
    report_path.write_text(render_markdown(records, run_info), encoding="utf-8")
    (out_dir / "summary.json").write_text(
        json.dumps(summarize_groups(records), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return report_path

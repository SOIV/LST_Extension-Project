import wave

from stt_bench.dataset import discover, load_reference, parse_timed_text

SRT = (
    "1\r\n00:00:01,500 --> 00:00:03,000\r\n<i>こんにちは</i>\r\n\r\n"
    "2\r\n00:00:03,200 --> 00:00:05,250\r\n今日は&amp;\r\n配信です\r\n"
)

VTT = """WEBVTT
Kind: captions

NOTE 이 블록은 무시되어야 함
00:00.000 --> 00:01.000 은 NOTE 안이 아니라 아래 큐

00:00.400 --> 00:02.000 align:start
<c.yellow>안녕하세요</c>

cue-2
00:02.100 --> 00:03.900
반갑습니다
"""


def test_parse_srt_extracts_text_and_bounds():
    ref = parse_timed_text(SRT)
    assert ref.text == "こんにちは 今日は& 配信です"
    assert ref.speech_start == 1.5
    assert ref.speech_end == 5.25


def test_parse_srt_with_doubled_carriage_returns():
    assert parse_timed_text(SRT.replace("\r\n", "\r\r\n")).text == "こんにちは 今日は& 配信です"


def test_parse_vtt_skips_header_and_settings():
    ref = parse_timed_text(VTT)
    assert ref.text.endswith("안녕하세요 반갑습니다")
    assert "WEBVTT" not in ref.text and "Kind" not in ref.text
    assert ref.speech_end == 3.9


def _write_wav(path, seconds=0.5, rate=16000):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * int(seconds * rate))


def test_discover_uses_first_folder_as_language(tmp_path):
    _write_wav(tmp_path / "ja" / "a.wav")
    (tmp_path / "ja" / "a.txt").write_text("テスト です", encoding="utf-8")
    _write_wav(tmp_path / "ko" / "stream1" / "b.wav")
    (tmp_path / "ko" / "stream1" / "b.srt").write_text(SRT, encoding="utf-8", newline="")
    _write_wav(tmp_path / "loose.wav")
    _write_wav(tmp_path / "en" / "noref.wav")

    clips, warnings = discover(tmp_path)
    assert [(c.id, c.lang) for c in clips] == [("ja/a", "ja"), ("ko/stream1/b", "ko")]
    assert clips[1].ref.source == "srt"
    assert len(warnings) == 2

    only_ko, _ = discover(tmp_path, ["ko"])
    assert [c.id for c in only_ko] == ["ko/stream1/b"]


def test_txt_reference_prefers_txt_and_collapses_whitespace(tmp_path):
    p = tmp_path / "x.txt"
    p.write_text("﻿line one\n  line   two\n", encoding="utf-8")
    assert load_reference(p).text == "line one line two"

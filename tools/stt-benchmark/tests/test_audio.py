import wave

import numpy as np

from stt_bench.audio import Audio, load_audio, speech_bounds, split_chunks, to_wav_bytes


def _tone(seconds, rate, freq=440.0, amp=0.5):
    t = np.arange(int(seconds * rate)) / rate
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def test_load_audio_resamples_wav(tmp_path):
    path = tmp_path / "a.wav"
    path.write_bytes(to_wav_bytes(_tone(2.0, 48000), 48000))
    audio = load_audio(path, 16000)
    assert audio.rate == 16000
    assert abs(audio.duration_sec - 2.0) < 0.05
    assert 0.3 < float(np.abs(audio.samples).max()) <= 1.0


def test_to_wav_bytes_roundtrip(tmp_path):
    data = to_wav_bytes(_tone(0.5, 16000), 16000)
    path = tmp_path / "b.wav"
    path.write_bytes(data)
    with wave.open(str(path)) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()) == (1, 2, 16000, 8000)


def test_speech_bounds_finds_tone_between_silence():
    rate = 16000
    samples = np.concatenate([np.zeros(rate), _tone(1.0, rate), np.zeros(rate)])
    start, end = speech_bounds(Audio(samples, rate))
    assert abs(start - 1.0) < 0.05
    assert abs(end - 2.0) < 0.05


def test_speech_bounds_silent_clip_is_none():
    assert speech_bounds(Audio(np.zeros(16000, dtype=np.float32), 16000)) is None


def test_split_chunks_drops_tiny_tail():
    rate = 16000
    assert [(c.start_sec, c.end_sec) for c in split_chunks(Audio(np.zeros(7 * rate), rate), 3.0)] == [
        (0.0, 3.0), (3.0, 6.0), (6.0, 7.0),
    ]
    assert len(split_chunks(Audio(np.zeros(int(6.1 * rate)), rate), 3.0)) == 2

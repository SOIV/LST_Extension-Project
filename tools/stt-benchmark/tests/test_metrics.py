from stt_bench.metrics import ErrorCounts, char_errors, normalize_text, summarize, word_errors


def test_normalize_strips_punctuation_case_and_width():
    assert normalize_text("Hello, World!") == "hello world"
    assert normalize_text("ＡＢＣ１２３") == "abc123"
    assert normalize_text("こんにちは。世界、「テスト」") == "こんにちは 世界 テスト"
    assert normalize_text("  안녕   하세요?! ") == "안녕 하세요"


def test_char_errors_counts_substitution():
    c = char_errors("こんにちは", "こんにちわ")
    assert (c.ref_len, c.substitutions, c.deletions, c.insertions) == (5, 1, 0, 0)
    assert c.rate == 0.2


def test_char_errors_ignores_spacing_and_punctuation():
    assert char_errors("안녕 하세요.", "안녕하세요").errors == 0


def test_char_errors_empty_hypothesis_is_all_deletions():
    c = char_errors("テスト", "")
    assert (c.ref_len, c.deletions, c.rate) == (3, 3, 1.0)


def test_char_errors_counts_hallucinated_insertions():
    c = char_errors("はい", "はいご視聴ありがとうございました")
    assert c.insertions == 14
    assert c.deletions == 0


def test_word_errors_english():
    w = word_errors("The cat sat.", "the cat sit")
    assert (w.ref_len, w.substitutions, w.errors) == (3, 1, 1)


def test_error_counts_add_is_micro_average():
    total = ErrorCounts(10, 9, 1, 0, 0) + ErrorCounts(90, 81, 0, 9, 0)
    assert total.ref_len == 100
    assert total.rate == 0.1


def test_summarize_skips_none():
    s = summarize([None, 100.0, 300.0])
    assert s["n"] == 2 and s["p50"] == 200.0 and s["max"] == 300.0
    assert summarize([None]) is None

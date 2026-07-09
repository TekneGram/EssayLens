from __future__ import annotations

import csv
import math
from collections import Counter
from pathlib import Path

from .utils import EVALUATION_RESULTS_DIR, ROOT, round_metric
try:
    from benchmarking.vocabulary_helpers import (
        COMMON_FUNCTION_WORDS,
        get_clean_words,
        load_word_counts,
    )
except ModuleNotFoundError:
    from vocabulary_helpers import (
        COMMON_FUNCTION_WORDS,
        get_clean_words,
        load_word_counts,
    )


VOCABULARY_ENHANCEMENTS_COLUMNS = ("SENTENCE", "UPDATED_SENTENCE")
WORD_COUNTS_PATH = ROOT.parent / "word_freq_data" / "word_counts.csv"


def load_vocabulary_enhancement_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def build_frequency_rank_lookup(path: Path) -> dict[str, int]:
    counts = load_word_counts(str(path))
    ranked_words = [word for word, _count in counts.most_common()]
    return {word: index + 1 for index, word in enumerate(ranked_words)}


def extract_lexical_tokens(texts: list[str]) -> list[str]:
    tokens: list[str] = []
    for text in texts:
        for token in get_clean_words(text):
            if token not in COMMON_FUNCTION_WORDS:
                tokens.append(token)
    return tokens


def root_ttr(total_types: int, total_tokens: int) -> float:
    if total_tokens == 0:
        return 0.0
    return total_types / math.sqrt(total_tokens)


def compute_frequency_band_percentages(
    tokens: list[str],
    rank_lookup: dict[str, int],
) -> dict[str, float]:
    total_tokens = len(tokens)
    counts = Counter({"top_1000": 0, "range_1001_2000": 0, "range_2001_3000": 0, "outside_3000": 0})

    for token in tokens:
        rank = rank_lookup.get(token)
        if rank is None:
            counts["outside_3000"] += 1
        elif rank <= 1000:
            counts["top_1000"] += 1
        elif rank <= 2000:
            counts["range_1001_2000"] += 1
        elif rank <= 3000:
            counts["range_2001_3000"] += 1
        else:
            counts["outside_3000"] += 1

    return {
        "PCT_TOP_1000": round_metric((counts["top_1000"] / total_tokens) * 100) if total_tokens else 0.0,
        "PCT_1001_2000": round_metric((counts["range_1001_2000"] / total_tokens) * 100) if total_tokens else 0.0,
        "PCT_2001_3000": round_metric((counts["range_2001_3000"] / total_tokens) * 100) if total_tokens else 0.0,
        "PCT_OUTSIDE_3000": round_metric((counts["outside_3000"] / total_tokens) * 100) if total_tokens else 0.0,
    }


def build_vocabulary_summary_row(
    label: str,
    texts: list[str],
    rank_lookup: dict[str, int],
) -> dict[str, str | int | float]:
    lexical_tokens = extract_lexical_tokens(texts)
    total_tokens = len(lexical_tokens)
    total_types = len(set(lexical_tokens))
    percentages = compute_frequency_band_percentages(lexical_tokens, rank_lookup)

    row: dict[str, str | int | float] = {
        "TEXT_SET": label,
        "TOTAL_TOKENS": total_tokens,
        "TOTAL_TYPES": total_types,
        "ROOT_TTR": round_metric(root_ttr(total_types, total_tokens)),
    }
    row.update(percentages)
    return row


def vocabulary_enhancements_eval(model: str) -> list[dict[str, str | int | float]]:
    rows = load_vocabulary_enhancement_rows(
        ROOT / "llm_responses" / f"vocabulary_enhancements_{model}.csv"
    )
    rank_lookup = build_frequency_rank_lookup(WORD_COUNTS_PATH)

    original_texts = [row["SENTENCE"].strip() for row in rows if row.get("SENTENCE", "").strip()]
    updated_texts = [
        row["UPDATED_SENTENCE"].strip()
        for row in rows
        if row.get("UPDATED_SENTENCE", "").strip()
    ]

    return [
        build_vocabulary_summary_row("ORIGINAL", original_texts, rank_lookup),
        build_vocabulary_summary_row("UPDATED", updated_texts, rank_lookup),
    ]


def save_vocabulary_enhancements_summary(
    model: str, rows: list[dict[str, str | int | float]]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_vocabulary_enhancements_summary.csv"
    fieldnames = [
        "TEXT_SET",
        "TOTAL_TOKENS",
        "TOTAL_TYPES",
        "ROOT_TTR",
        "PCT_TOP_1000",
        "PCT_1001_2000",
        "PCT_2001_3000",
        "PCT_OUTSIDE_3000",
    ]

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return output_path

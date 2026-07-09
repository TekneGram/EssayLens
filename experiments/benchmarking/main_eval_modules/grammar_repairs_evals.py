from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from .utils import (
    ALMOST_MATCH_F1_THRESHOLD,
    EVALUATION_RESULTS_DIR,
    LLM_RESPONSES_DIR,
    ROOT,
    compute_metrics,
    normalize_text,
    split_into_sentences,
    token_level_f1,
)


GOLD_GRAMMAR_PATH = ROOT / "essay_ablation_coding" / "essay_ablation_coding.csv"


@dataclass(frozen=True)
class GoldGrammarRow:
    essay_id: str
    sentence: str
    is_positive: bool


@dataclass(frozen=True)
class PredictedGrammarRow:
    essay_id: str
    sentence: str
    correction: str
    predicted_positive: bool


@dataclass(frozen=True)
class GrammarHallucinationRow:
    essay_id: str
    predicted_sentence: str
    correction: str
    predicted_label: int


@dataclass(frozen=True)
class GrammarDuplicateRow:
    essay_id: str
    duplicated_sentence: str
    correction: str
    predicted_label: int


def load_gold_grammar_rows() -> list[GoldGrammarRow]:
    rows: list[GoldGrammarRow] = []
    with GOLD_GRAMMAR_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            body_para_num = row["BODY_PARA_NUM"].strip()
            sentence = row["ABLATED_ESSAY"].strip()
            if body_para_num not in {"1", "2", "3"} or not sentence:
                continue
            rows.append(
                GoldGrammarRow(
                    essay_id=row["ESSAY_ID"].strip(),
                    sentence=normalize_text(sentence),
                    is_positive=row["GRAMMAR_ERROR_ADDED"].strip() == "1",
                )
            )
    return rows


def normalize_correction_label(sentence: str, correction: str) -> bool:
    normalized_sentence = normalize_text(sentence)
    normalized_correction = normalize_text(correction)
    if not normalized_correction or normalized_correction.lower() == "none":
        return False
    return normalized_correction != normalized_sentence


def expand_prediction_row(row: dict[str, str]) -> list[PredictedGrammarRow]:
    essay_id = row["ESSAY_ID"].strip()
    sentence = row["SENTENCE"].strip()
    correction = row["CORRECTION"].strip()

    sentence_parts = split_into_sentences(sentence)
    correction_parts = split_into_sentences(correction)
    if not sentence_parts:
        return []

    expanded_rows: list[PredictedGrammarRow] = []
    if len(correction_parts) == len(sentence_parts):
        paired_corrections = correction_parts
    else:
        paired_corrections = [correction] * len(sentence_parts)

    for sentence_part, correction_part in zip(sentence_parts, paired_corrections):
        normalized_sentence = normalize_text(sentence_part)
        normalized_correction = normalize_text(correction_part)
        expanded_rows.append(
            PredictedGrammarRow(
                essay_id=essay_id,
                sentence=normalized_sentence,
                correction=normalized_correction,
                predicted_positive=normalize_correction_label(
                    normalized_sentence,
                    normalized_correction,
                ),
            )
        )
    return expanded_rows


def load_predicted_grammar_rows(model: str) -> dict[str, list[PredictedGrammarRow]]:
    path = LLM_RESPONSES_DIR / f"grammar_repairs_{model}.csv"
    rows_by_essay: dict[str, list[PredictedGrammarRow]] = {}

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            for expanded_row in expand_prediction_row(row):
                rows_by_essay.setdefault(expanded_row.essay_id, []).append(expanded_row)

    return rows_by_essay


def group_gold_rows_by_essay(
    rows: list[GoldGrammarRow],
) -> dict[str, list[GoldGrammarRow]]:
    rows_by_essay: dict[str, list[GoldGrammarRow]] = {}
    for row in rows:
        rows_by_essay.setdefault(row.essay_id, []).append(row)
    return rows_by_essay


def match_predicted_to_gold(
    gold_rows: list[GoldGrammarRow],
    predicted_rows: list[PredictedGrammarRow],
) -> tuple[dict[int, int], set[int]]:
    candidate_pairs: list[tuple[float, int, int]] = []

    for predicted_index, predicted_row in enumerate(predicted_rows):
        for gold_index, gold_row in enumerate(gold_rows):
            score = token_level_f1(gold_row.sentence, predicted_row.sentence)
            if score >= ALMOST_MATCH_F1_THRESHOLD:
                candidate_pairs.append((-score, gold_index, predicted_index))

    candidate_pairs.sort()
    matched_gold: set[int] = set()
    matched_predictions: set[int] = set()
    predicted_to_gold: dict[int, int] = {}

    for negative_score, gold_index, predicted_index in candidate_pairs:
        del negative_score
        if gold_index in matched_gold or predicted_index in matched_predictions:
            continue
        matched_gold.add(gold_index)
        matched_predictions.add(predicted_index)
        predicted_to_gold[predicted_index] = gold_index

    return predicted_to_gold, matched_predictions


def sentence_matches_any_gold_row(
    gold_rows: list[GoldGrammarRow],
    candidate_sentence: str,
) -> bool:
    return any(
        token_level_f1(gold_row.sentence, candidate_sentence) >= ALMOST_MATCH_F1_THRESHOLD
        for gold_row in gold_rows
    )


def grammar_repairs_eval(
    model: str,
) -> tuple[
    dict[str, str | int | float],
    list[GrammarHallucinationRow],
    list[GrammarDuplicateRow],
]:
    gold_by_essay = group_gold_rows_by_essay(load_gold_grammar_rows())
    predicted_by_essay = load_predicted_grammar_rows(model)

    tp = 0
    tn = 0
    fp = 0
    fn = 0
    hallucinations: list[GrammarHallucinationRow] = []
    duplicates: list[GrammarDuplicateRow] = []

    all_essay_ids = sorted(set(gold_by_essay) | set(predicted_by_essay))
    for essay_id in all_essay_ids:
        essay_gold_rows = gold_by_essay.get(essay_id, [])
        essay_predicted_rows = predicted_by_essay.get(essay_id, [])

        predicted_to_gold, matched_predictions = match_predicted_to_gold(
            essay_gold_rows,
            essay_predicted_rows,
        )
        matched_gold_indices = set(predicted_to_gold.values())

        for predicted_index, gold_index in predicted_to_gold.items():
            gold_row = essay_gold_rows[gold_index]
            predicted_row = essay_predicted_rows[predicted_index]
            if predicted_row.predicted_positive:
                if gold_row.is_positive:
                    tp += 1
                else:
                    fp += 1
            else:
                if gold_row.is_positive:
                    fn += 1
                else:
                    tn += 1

        for gold_index, gold_row in enumerate(essay_gold_rows):
            if gold_index in matched_gold_indices:
                continue
            if gold_row.is_positive:
                fn += 1
            else:
                tn += 1

        for predicted_index, predicted_row in enumerate(essay_predicted_rows):
            if predicted_index in matched_predictions:
                continue
            if sentence_matches_any_gold_row(essay_gold_rows, predicted_row.sentence):
                duplicates.append(
                    GrammarDuplicateRow(
                        essay_id=essay_id,
                        duplicated_sentence=predicted_row.sentence,
                        correction=predicted_row.correction,
                        predicted_label=int(predicted_row.predicted_positive),
                    )
                )
            else:
                hallucinations.append(
                    GrammarHallucinationRow(
                        essay_id=essay_id,
                        predicted_sentence=predicted_row.sentence,
                        correction=predicted_row.correction,
                        predicted_label=int(predicted_row.predicted_positive),
                    )
                )

        if len(essay_gold_rows) != len(matched_gold_indices) + (
            len([row for index, row in enumerate(essay_gold_rows) if index not in matched_gold_indices])
        ):
            raise ValueError(f"Sentence accounting mismatch for essay {essay_id} in grammar_repairs")

    result: dict[str, str | int | float] = {"BENCHMARK_TYPE": "grammar_repairs"}
    result.update(compute_metrics(tp, tn, fp, fn))
    return result, hallucinations, duplicates


def save_grammar_repairs_hallucinations(
    model: str,
    rows: list[GrammarHallucinationRow],
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_grammar_repairs_hallucinations.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["ESSAY_ID", "PREDICTED_SENTENCE", "CORRECTION", "PREDICTED_LABEL"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "PREDICTED_SENTENCE": row.predicted_sentence,
                    "CORRECTION": row.correction,
                    "PREDICTED_LABEL": row.predicted_label,
                }
            )

    return output_path


def save_grammar_repairs_duplicates(
    model: str,
    rows: list[GrammarDuplicateRow],
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_grammar_repairs_duplicated.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["ESSAY_ID", "DUPLICATED_SENTENCE", "CORRECTION", "PREDICTED_LABEL"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "DUPLICATED_SENTENCE": row.duplicated_sentence,
                    "CORRECTION": row.correction,
                    "PREDICTED_LABEL": row.predicted_label,
                }
            )

    return output_path

from __future__ import annotations

import csv
import re
from pathlib import Path

from .utils import (
    ALMOST_MATCH_F1_THRESHOLD,
    EVALUATION_RESULTS_DIR,
    GENERATED_ESSAYS_ABLATED_DIR,
    GOLD_ALL_SENTENCES_PATH,
    GOLD_CITATION_PATH,
    GOLD_REFERENCE_PATH,
    DuplicatedCitationRow,
    EssaySentenceRow,
    GoldRow,
    HallucinatedReferenceRow,
    HallucinatedSentenceRow,
    LLM_RESPONSES_DIR,
    REFERENCE_ALMOST_MATCH_F1_THRESHOLD,
    compute_metrics,
    is_metadata_block,
    is_reference_metadata_block,
    load_gold_rows,
    load_model_rows,
    normalize_text,
    normalize_reference_text,
    reference_token_level_f1,
    split_into_sentences,
    token_level_f1,
)


def build_essay_ablation_all_sentences() -> list[EssaySentenceRow]:
    sentence_rows: list[EssaySentenceRow] = []

    for essay_path in sorted(GENERATED_ESSAYS_ABLATED_DIR.glob("essay_*.md")):
        essay_id_match = re.search(r"essay_(\d+)_", essay_path.name)
        if essay_id_match is None:
            continue

        essay_id = essay_id_match.group(1)
        blocks = [
            block.strip()
            for block in re.split(r"\n\s*\n", essay_path.read_text(encoding="utf-8"))
            if block.strip()
        ]

        in_references = False
        content_paragraph_index = 0
        row_index = 1

        for block in blocks:
            normalized_block = normalize_text(block)
            if normalized_block == "## References":
                in_references = True
                continue

            if in_references:
                if is_reference_metadata_block(block):
                    continue
                sentence_rows.append(
                    EssaySentenceRow(
                        essay_id=essay_id,
                        section_type="references",
                        row_index=row_index,
                        sentence=normalized_block,
                    )
                )
                row_index += 1
                continue

            if is_metadata_block(block):
                continue

            content_paragraph_index += 1
            if content_paragraph_index == 1:
                section_type = "introduction"
            elif content_paragraph_index == 5:
                section_type = "conclusion"
            else:
                section_type = f"body paragraph {content_paragraph_index - 1}"

            for sentence in split_into_sentences(block):
                sentence_rows.append(
                    EssaySentenceRow(
                        essay_id=essay_id,
                        section_type=section_type,
                        row_index=row_index,
                        sentence=sentence,
                    )
                )
                row_index += 1

    GOLD_ALL_SENTENCES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with GOLD_ALL_SENTENCES_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["ESSAY_ID", "SECTION_TYPE", "ROW_INDEX", "SENTENCE"],
        )
        writer.writeheader()
        for row in sentence_rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "SECTION_TYPE": row.section_type,
                    "ROW_INDEX": row.row_index,
                    "SENTENCE": row.sentence,
                }
            )

    return sentence_rows


def group_sentence_rows_by_essay(
    rows: list[EssaySentenceRow],
) -> dict[str, list[EssaySentenceRow]]:
    rows_by_essay: dict[str, list[EssaySentenceRow]] = {}
    for row in rows:
        rows_by_essay.setdefault(row.essay_id, []).append(row)
    return rows_by_essay


def match_sentences_to_universe(
    universe_rows: list[EssaySentenceRow],
    candidate_sentences: list[str],
) -> tuple[dict[int, int], set[int]]:
    candidate_pairs: list[tuple[float, int, int]] = []

    for candidate_index, candidate_sentence in enumerate(candidate_sentences):
        for universe_index, universe_row in enumerate(universe_rows):
            score = token_level_f1(universe_row.sentence, candidate_sentence)
            if score >= ALMOST_MATCH_F1_THRESHOLD:
                candidate_pairs.append((-score, universe_index, candidate_index))

    candidate_pairs.sort()
    matched_universe: set[int] = set()
    matched_candidates: set[int] = set()
    candidate_to_universe: dict[int, int] = {}

    for negative_score, universe_index, candidate_index in candidate_pairs:
        del negative_score
        if universe_index in matched_universe or candidate_index in matched_candidates:
            continue
        matched_universe.add(universe_index)
        matched_candidates.add(candidate_index)
        candidate_to_universe[candidate_index] = universe_index

    return candidate_to_universe, matched_candidates


def sentence_matches_any_universe_row(
    universe_rows: list[EssaySentenceRow],
    candidate_sentence: str,
) -> bool:
    return any(
        token_level_f1(universe_row.sentence, candidate_sentence) >= ALMOST_MATCH_F1_THRESHOLD
        for universe_row in universe_rows
    )


def should_keep_identify_citation_row_unsplit(
    raw_text: str,
    universe_rows: list[EssaySentenceRow],
) -> bool:
    normalized_text = normalize_text(raw_text)
    if normalized_text.count(".") <= 1:
        return False
    return sentence_matches_any_universe_row(universe_rows, normalized_text)


def align_gold_positive_indices(
    universe_by_essay: dict[str, list[EssaySentenceRow]],
    gold_positive_rows: list[GoldRow],
) -> dict[str, set[int]]:
    gold_positive_by_essay: dict[str, list[str]] = {}
    for row in gold_positive_rows:
        gold_positive_by_essay.setdefault(row.essay_id, []).append(row.text)

    positive_universe_indices_by_essay: dict[str, set[int]] = {}
    for essay_id, positive_sentences in gold_positive_by_essay.items():
        essay_universe_rows = universe_by_essay.get(essay_id, [])
        candidate_to_universe, _ = match_sentences_to_universe(
            essay_universe_rows,
            positive_sentences,
        )
        if len(candidate_to_universe) != len(positive_sentences):
            missing_count = len(positive_sentences) - len(candidate_to_universe)
            raise ValueError(
                f"Failed to align {missing_count} gold citation sentences for essay {essay_id}"
            )
        positive_universe_indices_by_essay[essay_id] = set(candidate_to_universe.values())

    return positive_universe_indices_by_essay


def evaluate_sentence_level_citation_benchmark(
    benchmark_type: str,
    predicted_sentences_by_essay: dict[str, list[str]],
    positive_universe_indices_by_essay: dict[str, set[int]],
    universe_by_essay: dict[str, list[EssaySentenceRow]],
) -> tuple[
    dict[str, str | int | float],
    list[HallucinatedSentenceRow],
    list[DuplicatedCitationRow],
]:
    tp = 0
    tn = 0
    fp = 0
    fn = 0
    hallucinated_rows: list[HallucinatedSentenceRow] = []
    duplicated_rows: list[DuplicatedCitationRow] = []

    all_essay_ids = sorted(set(universe_by_essay) | set(predicted_sentences_by_essay))
    for essay_id in all_essay_ids:
        essay_universe_rows = universe_by_essay.get(essay_id, [])
        predicted_sentences = predicted_sentences_by_essay.get(essay_id, [])
        positive_indices = positive_universe_indices_by_essay.get(essay_id, set())

        candidate_to_universe, matched_candidates = match_sentences_to_universe(
            essay_universe_rows,
            predicted_sentences,
        )
        matched_universe_indices = set(candidate_to_universe.values())

        for universe_index in matched_universe_indices:
            if universe_index in positive_indices:
                tp += 1
            else:
                fp += 1

        for universe_index, _ in enumerate(essay_universe_rows):
            if universe_index in matched_universe_indices:
                continue
            if universe_index in positive_indices:
                fn += 1
            else:
                tn += 1

        for candidate_index, predicted_sentence in enumerate(predicted_sentences):
            if candidate_index in matched_candidates:
                continue

            if sentence_matches_any_universe_row(essay_universe_rows, predicted_sentence):
                duplicated_rows.append(
                    DuplicatedCitationRow(
                        essay_id=essay_id,
                        duplicated_sentence=predicted_sentence,
                    )
                )
            else:
                hallucinated_rows.append(
                    HallucinatedSentenceRow(
                        essay_id=essay_id,
                        hallucinated_sentence=predicted_sentence,
                    )
                )

        essay_total = len(essay_universe_rows)
        if essay_total != len(matched_universe_indices) + (
            len(positive_indices - matched_universe_indices)
            + len(set(range(essay_total)) - positive_indices - matched_universe_indices)
        ):
            raise ValueError(
                f"Sentence accounting mismatch for essay {essay_id} in {benchmark_type}"
            )

    result: dict[str, str | int | float] = {"BENCHMARK_TYPE": benchmark_type}
    result.update(compute_metrics(tp, tn, fp, fn))
    return result, hallucinated_rows, duplicated_rows


def match_references_to_universe(
    universe_rows: list[GoldRow],
    candidate_references: list[str],
) -> tuple[dict[int, int], set[int]]:
    candidate_pairs: list[tuple[float, int, int]] = []

    for candidate_index, candidate_reference in enumerate(candidate_references):
        for universe_index, universe_row in enumerate(universe_rows):
            score = reference_token_level_f1(universe_row.text, candidate_reference)
            if score >= REFERENCE_ALMOST_MATCH_F1_THRESHOLD:
                candidate_pairs.append((-score, universe_index, candidate_index))

    candidate_pairs.sort()
    matched_universe: set[int] = set()
    matched_candidates: set[int] = set()
    candidate_to_universe: dict[int, int] = {}

    for negative_score, universe_index, candidate_index in candidate_pairs:
        del negative_score
        if universe_index in matched_universe or candidate_index in matched_candidates:
            continue
        matched_universe.add(universe_index)
        matched_candidates.add(candidate_index)
        candidate_to_universe[candidate_index] = universe_index

    return candidate_to_universe, matched_candidates


def evaluate_reference_level_benchmark(
    benchmark_type: str,
    gold_rows: list[GoldRow],
    predicted_references_by_essay: dict[str, list[str]],
) -> tuple[dict[str, str | int | float], list[HallucinatedReferenceRow]]:
    gold_by_essay: dict[str, list[GoldRow]] = {}
    for row in gold_rows:
        gold_by_essay.setdefault(row.essay_id, []).append(row)

    tp = 0
    tn = 0
    fp = 0
    fn = 0
    hallucinated_rows: list[HallucinatedReferenceRow] = []

    all_essay_ids = sorted(set(gold_by_essay) | set(predicted_references_by_essay))
    for essay_id in all_essay_ids:
        essay_gold_rows = gold_by_essay.get(essay_id, [])
        predicted_references = predicted_references_by_essay.get(essay_id, [])

        candidate_to_universe, matched_candidates = match_references_to_universe(
            essay_gold_rows,
            predicted_references,
        )
        matched_universe_indices = set(candidate_to_universe.values())

        for universe_index in matched_universe_indices:
            if essay_gold_rows[universe_index].is_positive:
                tp += 1
            else:
                fp += 1

        for universe_index, gold_row in enumerate(essay_gold_rows):
            if universe_index in matched_universe_indices:
                continue
            if gold_row.is_positive:
                fn += 1
            else:
                tn += 1

        for candidate_index, predicted_reference in enumerate(predicted_references):
            if candidate_index in matched_candidates:
                continue
            hallucinated_rows.append(
                HallucinatedReferenceRow(
                    essay_id=essay_id,
                    hallucinated_reference=predicted_reference,
                )
            )

    result: dict[str, str | int | float] = {"BENCHMARK_TYPE": benchmark_type}
    result.update(compute_metrics(tp, tn, fp, fn))
    return result, hallucinated_rows


def identified_citations(
    model: str,
) -> tuple[
    dict[str, str | int | float],
    list[HallucinatedSentenceRow],
    list[DuplicatedCitationRow],
]:
    universe_rows = build_essay_ablation_all_sentences()
    universe_by_essay = group_sentence_rows_by_essay(universe_rows)

    gold_positive_rows = load_gold_rows(
        GOLD_CITATION_PATH,
        text_column="SENTENCE_WITH_CITATION",
        label_column="CORRESPONDING_REFERENCE",
    )
    positive_universe_indices_by_essay = align_gold_positive_indices(
        universe_by_essay,
        gold_positive_rows,
    )

    model_rows = load_model_rows(
        LLM_RESPONSES_DIR / f"identify_citations_{model}.csv",
        text_column="SENTENCE_WITH_CITATION",
    )
    predicted_sentences_by_essay: dict[str, list[str]] = {}
    for row in model_rows:
        essay_universe_rows = universe_by_essay.get(row.essay_id, [])
        predicted_sentences = predicted_sentences_by_essay.setdefault(row.essay_id, [])
        if should_keep_identify_citation_row_unsplit(row.text, essay_universe_rows):
            predicted_sentences.append(normalize_text(row.text))
        else:
            predicted_sentences.extend(split_into_sentences(row.text))

    return evaluate_sentence_level_citation_benchmark(
        benchmark_type="identified_citations",
        predicted_sentences_by_essay=predicted_sentences_by_essay,
        positive_universe_indices_by_essay=positive_universe_indices_by_essay,
        universe_by_essay=universe_by_essay,
    )


def citation_no_references(
    model: str,
) -> tuple[
    dict[str, str | int | float],
    list[HallucinatedSentenceRow],
    list[DuplicatedCitationRow],
]:
    universe_rows = build_essay_ablation_all_sentences()
    universe_by_essay = group_sentence_rows_by_essay(universe_rows)

    gold_positive_rows = [
        row
        for row in load_gold_rows(
            GOLD_CITATION_PATH,
            text_column="SENTENCE_WITH_CITATION",
            label_column="CORRESPONDING_REFERENCE",
        )
        if row.is_positive
    ]
    positive_universe_indices_by_essay = align_gold_positive_indices(
        universe_by_essay,
        gold_positive_rows,
    )

    model_rows = load_model_rows(
        LLM_RESPONSES_DIR / f"citations_no_references_{model}.csv",
        text_column="CITATION",
    )
    predicted_sentences_by_essay: dict[str, list[str]] = {}
    for row in model_rows:
        predicted_sentences = predicted_sentences_by_essay.setdefault(row.essay_id, [])
        predicted_sentences.extend(split_into_sentences(row.text))

    return evaluate_sentence_level_citation_benchmark(
        benchmark_type="citation_no_reference",
        predicted_sentences_by_essay=predicted_sentences_by_essay,
        positive_universe_indices_by_essay=positive_universe_indices_by_essay,
        universe_by_essay=universe_by_essay,
    )


def reference_no_citations(
    model: str,
) -> tuple[dict[str, str | int | float], list[HallucinatedReferenceRow]]:
    gold_rows = load_gold_rows(
        GOLD_REFERENCE_PATH,
        text_column="REFERENCE",
        label_column="CORRESPONDING_CITATION",
    )
    model_rows = load_model_rows(
        LLM_RESPONSES_DIR / f"reference_has_no_citations_{model}.csv",
        text_column="REFERENCE",
    )
    predicted_references_by_essay: dict[str, list[str]] = {}
    for row in model_rows:
        predicted_references = predicted_references_by_essay.setdefault(row.essay_id, [])
        predicted_references.append(normalize_reference_text(row.text))

    return evaluate_reference_level_benchmark(
        benchmark_type="reference_no_citation",
        gold_rows=gold_rows,
        predicted_references_by_essay=predicted_references_by_essay,
    )


def save_identify_sentence_hallucinations(
    model: str, rows: list[HallucinatedSentenceRow]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_identify_citations_hallucinations.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["ESSAY_ID", "HALLUCINATED_SENTENCE"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "HALLUCINATED_SENTENCE": row.hallucinated_sentence,
                }
            )

    return output_path


def save_identify_citation_duplicates(
    model: str, rows: list[DuplicatedCitationRow]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_identify_citation_duplicated.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["ESSAY_ID", "DUPLICATED_SENTENCE"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "DUPLICATED_SENTENCE": row.duplicated_sentence,
                }
            )

    return output_path


def save_citation_no_reference_hallucinations(
    model: str, rows: list[HallucinatedSentenceRow]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_citation_no_reference_hallucinations.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["ESSAY_ID", "HALLUCINATED_SENTENCE"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "HALLUCINATED_SENTENCE": row.hallucinated_sentence,
                }
            )

    return output_path


def save_citation_no_reference_duplicates(
    model: str, rows: list[DuplicatedCitationRow]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_citation_no_reference_duplicated.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["ESSAY_ID", "DUPLICATED_SENTENCE"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "DUPLICATED_SENTENCE": row.duplicated_sentence,
                }
            )

    return output_path


def save_reference_no_citation_hallucinations(
    model: str, rows: list[HallucinatedReferenceRow]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_reference_no_citation_hallucinations.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["ESSAY_ID", "HALLUCINATED_REFERENCE"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "HALLUCINATED_REFERENCE": row.hallucinated_reference,
                }
            )

    return output_path

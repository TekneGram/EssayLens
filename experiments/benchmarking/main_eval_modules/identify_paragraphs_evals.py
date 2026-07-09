from __future__ import annotations

import csv
from pathlib import Path

from .utils import (
    ALMOST_MATCH_F1_THRESHOLD,
    EVALUATION_RESULTS_DIR,
    GOLD_IDENTIFY_PARAGRAPHS_PATH,
    LLM_RESPONSES_DIR,
    IdentifyParagraphComparisonRow,
    IdentifyParagraphRow,
    load_identify_paragraph_rows,
    normalize_text,
    round_metric,
    safe_divide,
    token_level_f1,
)


def build_rows_by_essay(
    rows: list[IdentifyParagraphRow],
) -> dict[str, list[IdentifyParagraphRow]]:
    rows_by_essay: dict[str, list[IdentifyParagraphRow]] = {}
    for row in rows:
        rows_by_essay.setdefault(row.essay_id, []).append(row)
    return rows_by_essay


def _blank_identify_paragraph_row(essay_id: str) -> IdentifyParagraphRow:
    return IdentifyParagraphRow(essay_id=essay_id, para_type="", paragraph="")


def identify_paragraphs(
    model: str,
) -> tuple[dict[str, str | int | float], list[IdentifyParagraphComparisonRow]]:
    response_path = LLM_RESPONSES_DIR / f"identify_paragraphs_{model}.csv"
    gold_rows = load_identify_paragraph_rows(GOLD_IDENTIFY_PARAGRAPHS_PATH)
    model_rows = load_identify_paragraph_rows(response_path)

    gold_by_essay = build_rows_by_essay(gold_rows)
    model_by_essay = build_rows_by_essay(model_rows)

    comparison_rows: list[IdentifyParagraphComparisonRow] = []
    classify_paragraph_num = 0
    exact_match_num = 0
    almost_match_num = 0
    unmatched_num = 0

    for essay_id in sorted(gold_by_essay):
        gold_essay_rows = gold_by_essay[essay_id]
        model_essay_rows = model_by_essay.get(essay_id, [])
        aligned_row_count = max(len(gold_essay_rows), len(model_essay_rows))

        for index in range(aligned_row_count):
            gold_row = (
                gold_essay_rows[index]
                if index < len(gold_essay_rows)
                else _blank_identify_paragraph_row(essay_id)
            )
            model_row = (
                model_essay_rows[index]
                if index < len(model_essay_rows)
                else _blank_identify_paragraph_row(essay_id)
            )
            exact_match = int(
                normalize_text(gold_row.paragraph) == normalize_text(model_row.paragraph)
            )
            token_f1 = token_level_f1(gold_row.paragraph, model_row.paragraph)
            almost_match = int((not exact_match) and token_f1 >= ALMOST_MATCH_F1_THRESHOLD)
            unmatched = int((not exact_match) and (not almost_match))
            classify_paragraph_correct = int(
                gold_row.para_type == model_row.para_type and (exact_match or almost_match)
            )

            classify_paragraph_num += classify_paragraph_correct
            exact_match_num += exact_match
            almost_match_num += almost_match
            unmatched_num += unmatched

            comparison_rows.append(
                IdentifyParagraphComparisonRow(
                    essay_id=essay_id,
                    row_index=index + 1,
                    gold_para_type=gold_row.para_type,
                    predicted_para_type=model_row.para_type,
                    gold_paragraph=gold_row.paragraph,
                    predicted_paragraph=model_row.paragraph,
                    token_f1=round_metric(token_f1),
                    exact_match=exact_match,
                    almost_match=almost_match,
                    unmatched=unmatched,
                    classify_paragraph_correct=classify_paragraph_correct,
                )
            )

    total_compared_rows = len(comparison_rows)
    summary = {
        "BENCHMARK_TYPE": "identify_paragraphs",
        "CLASSIFY_PARAGRAPH_PERCENT": round_metric(
            safe_divide(classify_paragraph_num, total_compared_rows)
        ),
        "CLASSIFY_PARAGRAPH_NUM": classify_paragraph_num,
        "EXACT_MATCH_PERCENT": round_metric(
            safe_divide(exact_match_num, total_compared_rows)
        ),
        "ALMOST_MATCH_PERCENT": round_metric(
            safe_divide(almost_match_num, total_compared_rows)
        ),
        "UNMATCHED_PERCENT": round_metric(
            safe_divide(unmatched_num, total_compared_rows)
        ),
    }

    return summary, comparison_rows


def save_identify_paragraph_results(
    model: str, result: dict[str, str | int | float]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_identify_paragraphs_evals.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "BENCHMARK_TYPE",
                "CLASSIFY_PARAGRAPH_PERCENT",
                "CLASSIFY_PARAGRAPH_NUM",
                "EXACT_MATCH_PERCENT",
                "ALMOST_MATCH_PERCENT",
                "UNMATCHED_PERCENT",
            ],
        )
        writer.writeheader()
        writer.writerow(result)

    return output_path


def save_identify_paragraph_token_f1_results(
    model: str, rows: list[IdentifyParagraphComparisonRow]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_identify_paragraphs_token_f1.csv"

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "ESSAY_ID",
                "ROW_INDEX",
                "GOLD_PARA_TYPE",
                "PREDICTED_PARA_TYPE",
                "GOLD_PARAGRAPH",
                "PREDICTED_PARAGRAPH",
                "TOKEN_F1",
                "EXACT_MATCH",
                "ALMOST_MATCH",
                "UNMATCHED",
                "CLASSIFY_PARAGRAPH_CORRECT",
            ],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "ROW_INDEX": row.row_index,
                    "GOLD_PARA_TYPE": row.gold_para_type,
                    "PREDICTED_PARA_TYPE": row.predicted_para_type,
                    "GOLD_PARAGRAPH": row.gold_paragraph,
                    "PREDICTED_PARAGRAPH": row.predicted_paragraph,
                    "TOKEN_F1": row.token_f1,
                    "EXACT_MATCH": row.exact_match,
                    "ALMOST_MATCH": row.almost_match,
                    "UNMATCHED": row.unmatched,
                    "CLASSIFY_PARAGRAPH_CORRECT": row.classify_paragraph_correct,
                }
            )

    return output_path

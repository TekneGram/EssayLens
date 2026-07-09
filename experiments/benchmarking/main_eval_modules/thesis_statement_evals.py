from __future__ import annotations

import csv
import statistics
from pathlib import Path

from .utils import (
    EVALUATION_RESULTS_DIR,
    ROOT,
    compute_metrics,
    match_by_containment,
    normalize_text,
    round_metric,
    token_level_f1,
)


GOLD_THESIS_STATEMENT_PATH = ROOT / "essay_ablation_coding" / "thesis_statement.csv"


def load_thesis_rows(path: Path) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            essay_id = row["ESSAY_ID"].strip()
            rows[essay_id] = {
                "has_thesis_statement": row["HAS_THESIS_STATEMENT"].strip(),
                "thesis_statement": row["THESIS_STATEMENT"].strip(),
            }
    return rows


def thesis_statement_eval(
    model: str,
) -> tuple[list[dict[str, str | int | float]], dict[str, str | int | float]]:
    gold_rows = load_thesis_rows(GOLD_THESIS_STATEMENT_PATH)
    model_rows = load_thesis_rows(ROOT / "llm_responses" / f"thesis_statement_{model}.csv")

    tp = 0
    tn = 0
    fp = 0
    fn = 0
    token_f1_scores: list[float] = []
    exact_match_count = 0
    containment_match_count = 0
    high_match_count = 0
    medium_match_count = 0
    low_match_count = 0
    num_gold_positive_essays = 0
    row_results: list[dict[str, str | int | float]] = []

    all_essay_ids = sorted(set(gold_rows) | set(model_rows))
    for essay_id in all_essay_ids:
        gold_row = gold_rows.get(
            essay_id,
            {"has_thesis_statement": "no", "thesis_statement": ""},
        )
        model_row = model_rows.get(
            essay_id,
            {"has_thesis_statement": "no clear statement", "thesis_statement": ""},
        )

        gold_has_positive = gold_row["has_thesis_statement"] == "yes"
        pred_has_positive = model_row["has_thesis_statement"] == "yes"

        detection_tp = int(gold_has_positive and pred_has_positive)
        detection_tn = int((not gold_has_positive) and (not pred_has_positive))
        detection_fp = int((not gold_has_positive) and pred_has_positive)
        detection_fn = int(gold_has_positive and (not pred_has_positive))
        detection_correct = int((gold_has_positive and pred_has_positive) or ((not gold_has_positive) and (not pred_has_positive)))

        tp += detection_tp
        tn += detection_tn
        fp += detection_fp
        fn += detection_fn

        result_row: dict[str, str | int | float] = {
            "ESSAY_ID": essay_id,
            "GOLD_HAS_THESIS_STATEMENT": gold_row["has_thesis_statement"],
            "PRED_HAS_THESIS_STATEMENT": model_row["has_thesis_statement"],
            "DETECTION_CORRECT": detection_correct,
            "DETECTION_TP": detection_tp,
            "DETECTION_TN": detection_tn,
            "DETECTION_FP": detection_fp,
            "DETECTION_FN": detection_fn,
            "GOLD_THESIS_STATEMENT": gold_row["thesis_statement"],
            "PRED_THESIS_STATEMENT": model_row["thesis_statement"],
            "EXACT_MATCH": "",
            "CONTAINMENT_MATCH": "",
            "TOKEN_F1": "",
        }

        if gold_has_positive:
            num_gold_positive_essays += 1
            exact_match = int(
                normalize_text(gold_row["thesis_statement"])
                == normalize_text(model_row["thesis_statement"])
            )
            containment_match = int(
                match_by_containment(
                    gold_row["thesis_statement"],
                    model_row["thesis_statement"],
                )
            )
            token_f1_score = token_level_f1(
                gold_row["thesis_statement"],
                model_row["thesis_statement"],
            )
            token_f1_scores.append(token_f1_score)
            exact_match_count += exact_match
            containment_match_count += containment_match
            if token_f1_score >= 0.90:
                high_match_count += 1
            elif token_f1_score >= 0.75:
                medium_match_count += 1
            else:
                low_match_count += 1

            result_row["EXACT_MATCH"] = exact_match
            result_row["CONTAINMENT_MATCH"] = containment_match
            result_row["TOKEN_F1"] = round_metric(token_f1_score)

        row_results.append(result_row)

    detection_metrics = compute_metrics(tp, tn, fp, fn)
    summary: dict[str, str | int | float] = {
        "NUM_ESSAYS": len(all_essay_ids),
        "NUM_GOLD_POSITIVE_ESSAYS": num_gold_positive_essays,
        "DETECTION_TP": detection_metrics["TP"],
        "DETECTION_TN": detection_metrics["TN"],
        "DETECTION_FP": detection_metrics["FP"],
        "DETECTION_FN": detection_metrics["FN"],
        "DETECTION_PRECISION": detection_metrics["PRECISION"],
        "DETECTION_RECALL": detection_metrics["RECALL"],
        "DETECTION_F1": detection_metrics["F1"],
        "DETECTION_ACCURACY": detection_metrics["ACCURACY"],
        "EXACT_MATCH_RATE": round_metric(exact_match_count / num_gold_positive_essays)
        if num_gold_positive_essays
        else 0.0,
        "CONTAINMENT_MATCH_RATE": round_metric(containment_match_count / num_gold_positive_essays)
        if num_gold_positive_essays
        else 0.0,
        "AVG_TOKEN_F1": round_metric(sum(token_f1_scores) / len(token_f1_scores))
        if token_f1_scores
        else 0.0,
        "MEDIAN_TOKEN_F1": round_metric(statistics.median(token_f1_scores))
        if token_f1_scores
        else 0.0,
        "TOKEN_F1_AT_LEAST_0.90": high_match_count,
        "TOKEN_F1_AT_LEAST_0.75": medium_match_count,
        "TOKEN_F1_BELOW_0.75": low_match_count,
    }
    return row_results, summary


def save_thesis_statement_eval_rows(
    model: str, rows: list[dict[str, str | int | float]]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_thesis_statement_eval_rows.csv"
    fieldnames = [
        "ESSAY_ID",
        "GOLD_HAS_THESIS_STATEMENT",
        "PRED_HAS_THESIS_STATEMENT",
        "DETECTION_CORRECT",
        "DETECTION_TP",
        "DETECTION_TN",
        "DETECTION_FP",
        "DETECTION_FN",
        "GOLD_THESIS_STATEMENT",
        "PRED_THESIS_STATEMENT",
        "EXACT_MATCH",
        "CONTAINMENT_MATCH",
        "TOKEN_F1",
    ]

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return output_path


def save_thesis_statement_eval_summary(
    model: str, summary: dict[str, str | int | float]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_thesis_statement_eval_summary.csv"
    fieldnames = list(summary.keys())

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(summary)

    return output_path

from __future__ import annotations

import csv
from pathlib import Path

from .utils import EVALUATION_RESULTS_DIR, ROOT, compute_metrics, round_metric


GOLD_CONCLUSION_ANALYSIS_PATH = ROOT / "essay_ablation_coding" / "conclusion_analysis.csv"
CONCLUSION_ANALYSIS_BINARY_COLUMNS = (
    "RESTATE_MAIN_IDEA",
    "SUFFICIENT_SUMMARY",
    "STRONG_FINAL_COMMENT",
)


def load_gold_conclusion_analysis_rows(path: Path) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            essay_id = row["ESSAY_ID"].strip()
            rows[essay_id] = {
                column: row[column].strip()
                for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS
            }
    return rows


def load_model_conclusion_analysis_rows(path: Path) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            essay_id = row["ESSAY_ID"].strip()
            rows[essay_id] = {
                column: row[column].strip().lower()
                for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS
            }
    return rows


def conclusion_analysis_eval(model: str) -> dict[str, str | int | float]:
    gold_rows = load_gold_conclusion_analysis_rows(GOLD_CONCLUSION_ANALYSIS_PATH)
    model_rows = load_model_conclusion_analysis_rows(
        ROOT / "llm_responses" / f"conclusion_analysis_{model}.csv"
    )

    all_essay_ids = sorted(gold_rows)
    label_metrics: dict[str, dict[str, int | float]] = {}
    subset_matches = 0
    pooled_tp = 0
    pooled_tn = 0
    pooled_fp = 0
    pooled_fn = 0

    for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS:
        tp = 0
        tn = 0
        fp = 0
        fn = 0

        for essay_id in all_essay_ids:
            gold_value = gold_rows[essay_id][column] == "1"
            pred_value = model_rows.get(essay_id, {}).get(column, "no") == "yes"

            if gold_value and pred_value:
                tp += 1
            elif (not gold_value) and (not pred_value):
                tn += 1
            elif (not gold_value) and pred_value:
                fp += 1
            else:
                fn += 1

        metrics = compute_metrics(tp, tn, fp, fn)
        label_metrics[column] = metrics
        pooled_tp += tp
        pooled_tn += tn
        pooled_fp += fp
        pooled_fn += fn

    for essay_id in all_essay_ids:
        if all(
            (gold_rows[essay_id][column] == "1")
            == (model_rows.get(essay_id, {}).get(column, "no") == "yes")
            for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS
        ):
            subset_matches += 1

    pooled_metrics = compute_metrics(pooled_tp, pooled_tn, pooled_fp, pooled_fn)
    macro_precision = round_metric(
        sum(float(label_metrics[column]["PRECISION"]) for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS)
        / len(CONCLUSION_ANALYSIS_BINARY_COLUMNS)
    )
    macro_recall = round_metric(
        sum(float(label_metrics[column]["RECALL"]) for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS)
        / len(CONCLUSION_ANALYSIS_BINARY_COLUMNS)
    )
    macro_f1 = round_metric(
        sum(float(label_metrics[column]["F1"]) for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS)
        / len(CONCLUSION_ANALYSIS_BINARY_COLUMNS)
    )
    macro_accuracy = round_metric(
        sum(float(label_metrics[column]["ACCURACY"]) for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS)
        / len(CONCLUSION_ANALYSIS_BINARY_COLUMNS)
    )

    summary: dict[str, str | int | float] = {
        "NUM_ESSAYS": len(all_essay_ids),
        "TOTAL_LABEL_DECISIONS": len(all_essay_ids) * len(CONCLUSION_ANALYSIS_BINARY_COLUMNS),
        "SUBSET_ACCURACY": round_metric(subset_matches / len(all_essay_ids))
        if all_essay_ids
        else 0.0,
        "POOLED_TP": pooled_metrics["TP"],
        "POOLED_TN": pooled_metrics["TN"],
        "POOLED_FP": pooled_metrics["FP"],
        "POOLED_FN": pooled_metrics["FN"],
        "POOLED_PRECISION": pooled_metrics["PRECISION"],
        "POOLED_RECALL": pooled_metrics["RECALL"],
        "POOLED_F1": pooled_metrics["F1"],
        "POOLED_ACCURACY": pooled_metrics["ACCURACY"],
    }

    for column in CONCLUSION_ANALYSIS_BINARY_COLUMNS:
        metrics = label_metrics[column]
        summary[f"{column}_TP"] = metrics["TP"]
        summary[f"{column}_TN"] = metrics["TN"]
        summary[f"{column}_FP"] = metrics["FP"]
        summary[f"{column}_FN"] = metrics["FN"]
        summary[f"{column}_PRECISION"] = metrics["PRECISION"]
        summary[f"{column}_RECALL"] = metrics["RECALL"]
        summary[f"{column}_F1"] = metrics["F1"]
        summary[f"{column}_ACCURACY"] = metrics["ACCURACY"]

    summary["MICRO_PRECISION"] = pooled_metrics["PRECISION"]
    summary["MICRO_RECALL"] = pooled_metrics["RECALL"]
    summary["MICRO_F1"] = pooled_metrics["F1"]
    summary["MICRO_ACCURACY"] = pooled_metrics["ACCURACY"]
    summary["MACRO_PRECISION"] = macro_precision
    summary["MACRO_RECALL"] = macro_recall
    summary["MACRO_F1"] = macro_f1
    summary["MACRO_ACCURACY"] = macro_accuracy
    return summary


def save_conclusion_analysis_eval_summary(
    model: str, summary: dict[str, str | int | float]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_conclusion_analysis_eval_summary.csv"
    fieldnames = list(summary.keys())

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(summary)

    return output_path

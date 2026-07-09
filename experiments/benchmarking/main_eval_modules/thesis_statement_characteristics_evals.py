from __future__ import annotations

import csv
from pathlib import Path

from .utils import EVALUATION_RESULTS_DIR, ROOT, compute_metrics, round_metric


GOLD_THESIS_CHARACTERISTICS_PATH = (
    ROOT / "essay_ablation_coding" / "thesis_statement_characteristics.csv"
)
THESIS_CHARACTERISTIC_COLUMNS = (
    "MAIN_IDEA",
    "CLEAR_GOAL",
    "PREVIEW_TOPICS",
    "WRITER_OPINION",
)


def load_thesis_characteristics_rows(path: Path) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            essay_id = row["ESSAY_ID"].strip()
            rows[essay_id] = {
                column: row[column].strip().lower()
                for column in THESIS_CHARACTERISTIC_COLUMNS
            }
    return rows


def thesis_statement_characteristics_eval(model: str) -> dict[str, str | int | float]:
    gold_rows = load_thesis_characteristics_rows(GOLD_THESIS_CHARACTERISTICS_PATH)
    model_rows = load_thesis_characteristics_rows(
        ROOT / "llm_responses" / f"thesis_statement_characteristics_{model}.csv"
    )

    all_essay_ids = sorted(gold_rows)
    label_metrics: dict[str, dict[str, int | float]] = {}
    subset_matches = 0
    micro_tp = 0
    micro_tn = 0
    micro_fp = 0
    micro_fn = 0

    for column in THESIS_CHARACTERISTIC_COLUMNS:
        tp = 0
        tn = 0
        fp = 0
        fn = 0

        for essay_id in all_essay_ids:
            gold_value = gold_rows[essay_id][column] == "yes"
            pred_row = model_rows.get(
                essay_id,
                {label: "no" for label in THESIS_CHARACTERISTIC_COLUMNS},
            )
            pred_value = pred_row[column] == "yes"

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
        micro_tp += tp
        micro_tn += tn
        micro_fp += fp
        micro_fn += fn

    for essay_id in all_essay_ids:
        pred_row = model_rows.get(
            essay_id,
            {label: "no" for label in THESIS_CHARACTERISTIC_COLUMNS},
        )
        if all(gold_rows[essay_id][column] == pred_row[column] for column in THESIS_CHARACTERISTIC_COLUMNS):
            subset_matches += 1

    micro_metrics = compute_metrics(micro_tp, micro_tn, micro_fp, micro_fn)
    macro_precision = round_metric(
        sum(float(label_metrics[column]["PRECISION"]) for column in THESIS_CHARACTERISTIC_COLUMNS)
        / len(THESIS_CHARACTERISTIC_COLUMNS)
    )
    macro_recall = round_metric(
        sum(float(label_metrics[column]["RECALL"]) for column in THESIS_CHARACTERISTIC_COLUMNS)
        / len(THESIS_CHARACTERISTIC_COLUMNS)
    )
    macro_f1 = round_metric(
        sum(float(label_metrics[column]["F1"]) for column in THESIS_CHARACTERISTIC_COLUMNS)
        / len(THESIS_CHARACTERISTIC_COLUMNS)
    )
    macro_accuracy = round_metric(
        sum(float(label_metrics[column]["ACCURACY"]) for column in THESIS_CHARACTERISTIC_COLUMNS)
        / len(THESIS_CHARACTERISTIC_COLUMNS)
    )

    summary: dict[str, str | int | float] = {
        "NUM_ESSAYS": len(all_essay_ids),
        "TOTAL_LABEL_DECISIONS": len(all_essay_ids) * len(THESIS_CHARACTERISTIC_COLUMNS),
        "SUBSET_ACCURACY": round_metric(subset_matches / len(all_essay_ids))
        if all_essay_ids
        else 0.0,
        "POOLED_TP": micro_metrics["TP"],
        "POOLED_TN": micro_metrics["TN"],
        "POOLED_FP": micro_metrics["FP"],
        "POOLED_FN": micro_metrics["FN"],
        "POOLED_PRECISION": micro_metrics["PRECISION"],
        "POOLED_RECALL": micro_metrics["RECALL"],
        "POOLED_F1": micro_metrics["F1"],
        "POOLED_ACCURACY": micro_metrics["ACCURACY"],
    }

    for column in THESIS_CHARACTERISTIC_COLUMNS:
        metrics = label_metrics[column]
        summary[f"{column}_TP"] = metrics["TP"]
        summary[f"{column}_TN"] = metrics["TN"]
        summary[f"{column}_FP"] = metrics["FP"]
        summary[f"{column}_FN"] = metrics["FN"]
        summary[f"{column}_PRECISION"] = metrics["PRECISION"]
        summary[f"{column}_RECALL"] = metrics["RECALL"]
        summary[f"{column}_F1"] = metrics["F1"]
        summary[f"{column}_ACCURACY"] = metrics["ACCURACY"]

    summary["MICRO_PRECISION"] = micro_metrics["PRECISION"]
    summary["MICRO_RECALL"] = micro_metrics["RECALL"]
    summary["MICRO_F1"] = micro_metrics["F1"]
    summary["MICRO_ACCURACY"] = micro_metrics["ACCURACY"]
    summary["MACRO_PRECISION"] = macro_precision
    summary["MACRO_RECALL"] = macro_recall
    summary["MACRO_F1"] = macro_f1
    summary["MACRO_ACCURACY"] = macro_accuracy
    return summary


def save_thesis_statement_characteristics_eval_summary(
    model: str, summary: dict[str, str | int | float]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = (
        EVALUATION_RESULTS_DIR / f"{model}_thesis_statement_characteristics_eval_summary.csv"
    )
    fieldnames = list(summary.keys())

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(summary)

    return output_path

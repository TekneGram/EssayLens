from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from .utils import EVALUATION_RESULTS_DIR, ROOT, round_metric, safe_divide, token_level_f1


GOLD_COHERENCE_LINGUISTIC_PATH = ROOT / "llm_expected_responses" / "coherence_linguistic.csv"
COHERENCE_LABELS = (
    "satisfactory",
    "show cause and effect",
    "use elaboration words",
    "add an addition connector",
    "add a contrast",
    "show reason",
)
COHERENCE_SHORT_NAMES = {
    "satisfactory": "SATISFACTORY",
    "show cause and effect": "CAUSE_EFFECT",
    "use elaboration words": "ELABORATION_WORDS",
    "add an addition connector": "ADDITION_CONNECTOR",
    "add a contrast": "CONTRAST",
    "show reason": "SHOW_REASON",
}


@dataclass(frozen=True)
class LinguisticCoherenceRow:
    essay_id: str
    para_num: str
    sentence: str
    coherence: str
    comment: str


@dataclass(frozen=True)
class HallucinatedLinguisticCoherenceRow:
    essay_id: str
    para_num: str
    pred_sentence: str
    pred_coherence: str
    reason: str


def normalize_coherence(value: str) -> str:
    return " ".join(value.strip().split())


def load_linguistic_coherence_rows(path: Path) -> tuple[list[LinguisticCoherenceRow], int]:
    rows: list[LinguisticCoherenceRow] = []
    excluded_rows = 0

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)

        for raw_row in reader:
            if len(raw_row) < 4:
                excluded_rows += 1
                continue

            essay_id = raw_row[0].strip()
            para_num = raw_row[1].strip()
            remainder = [field.strip() for field in raw_row[2:]]

            coherence_index = None
            coherence_value = ""
            for index, field in enumerate(remainder):
                normalized_field = normalize_coherence(field)
                if normalized_field in COHERENCE_LABELS:
                    coherence_index = index
                    coherence_value = normalized_field
                    break

            if coherence_index is None:
                excluded_rows += 1
                continue

            sentence = ", ".join(part for part in remainder[:coherence_index] if part).strip()
            comment = ", ".join(part for part in remainder[coherence_index + 1 :] if part).strip()

            if not essay_id or not para_num or not sentence:
                excluded_rows += 1
                continue

            rows.append(
                LinguisticCoherenceRow(
                    essay_id=essay_id,
                    para_num=para_num,
                    sentence=sentence,
                    coherence=coherence_value,
                    comment=comment,
                )
            )

    return rows, excluded_rows


def group_rows_by_essay(
    rows: list[LinguisticCoherenceRow],
) -> dict[str, list[LinguisticCoherenceRow]]:
    grouped: dict[str, list[LinguisticCoherenceRow]] = {}
    for row in rows:
        grouped.setdefault(row.essay_id, []).append(row)
    return grouped


def match_rows(
    gold_rows: list[LinguisticCoherenceRow],
    pred_rows: list[LinguisticCoherenceRow],
    threshold: float = 0.9,
) -> tuple[dict[int, int], set[int]]:
    candidate_pairs: list[tuple[float, int, int]] = []

    for pred_index, pred_row in enumerate(pred_rows):
        for gold_index, gold_row in enumerate(gold_rows):
            score = token_level_f1(gold_row.sentence, pred_row.sentence)
            if score >= threshold:
                candidate_pairs.append((-score, gold_index, pred_index))

    candidate_pairs.sort()
    matched_gold: set[int] = set()
    matched_pred: set[int] = set()
    pred_to_gold: dict[int, int] = {}

    for negative_score, gold_index, pred_index in candidate_pairs:
        del negative_score
        if gold_index in matched_gold or pred_index in matched_pred:
            continue
        matched_gold.add(gold_index)
        matched_pred.add(pred_index)
        pred_to_gold[pred_index] = gold_index

    return pred_to_gold, matched_pred


def compute_binary_metrics(tp: int, fp: int, fn: int) -> dict[str, int | float]:
    precision = safe_divide(tp, tp + fp)
    recall = safe_divide(tp, tp + fn)
    f1 = safe_divide(2 * precision * recall, precision + recall)
    return {
        "TP": tp,
        "FP": fp,
        "FN": fn,
        "PRECISION": round_metric(precision),
        "RECALL": round_metric(recall),
        "F1": round_metric(f1),
    }


def compute_class_metrics(
    confusion: dict[tuple[str, str], int], label: str
) -> dict[str, int | float]:
    tp = confusion[(label, label)]
    fp = sum(confusion[(gold, label)] for gold in COHERENCE_LABELS if gold != label)
    fn = sum(confusion[(label, pred)] for pred in COHERENCE_LABELS if pred != label)
    return compute_binary_metrics(tp, fp, fn)


def coherence_linguistic_eval(
    model: str,
) -> tuple[
    dict[str, str | int | float],
    dict[str, str | int | float],
    dict[str, str | int | float],
    list[HallucinatedLinguisticCoherenceRow],
]:
    gold_rows, excluded_gold_rows = load_linguistic_coherence_rows(
        GOLD_COHERENCE_LINGUISTIC_PATH
    )
    pred_rows, excluded_pred_rows = load_linguistic_coherence_rows(
        ROOT / "llm_responses" / f"coherence_linguistic_{model}.csv"
    )

    gold_by_essay = group_rows_by_essay(gold_rows)
    pred_by_essay = group_rows_by_essay(pred_rows)

    match_tp = 0
    match_fp = 0
    match_fn = 0
    matched_sentence_count = 0
    agreement_count = 0
    disagreement_count = 0
    end_to_end_tp = 0
    end_to_end_fp = 0
    end_to_end_fn = 0
    hallucinated_rows: list[HallucinatedLinguisticCoherenceRow] = []
    confusion = {
        (gold_label, pred_label): 0
        for gold_label in COHERENCE_LABELS
        for pred_label in COHERENCE_LABELS
    }

    all_essay_ids = sorted(set(gold_by_essay) | set(pred_by_essay))
    for essay_id in all_essay_ids:
        essay_gold_rows = gold_by_essay.get(essay_id, [])
        essay_pred_rows = pred_by_essay.get(essay_id, [])
        pred_to_gold, matched_pred = match_rows(essay_gold_rows, essay_pred_rows)
        matched_gold_indices = set(pred_to_gold.values())

        match_tp += len(pred_to_gold)
        match_fp += len(essay_pred_rows) - len(matched_pred)
        match_fn += len(essay_gold_rows) - len(matched_gold_indices)

        for pred_index, pred_row in enumerate(essay_pred_rows):
            if pred_index in matched_pred:
                continue
            hallucinated_rows.append(
                HallucinatedLinguisticCoherenceRow(
                    essay_id=pred_row.essay_id,
                    para_num=pred_row.para_num,
                    pred_sentence=pred_row.sentence,
                    pred_coherence=pred_row.coherence,
                    reason="no_matching_gold_sentence",
                )
            )

        for pred_index, gold_index in pred_to_gold.items():
            pred_row = essay_pred_rows[pred_index]
            gold_row = essay_gold_rows[gold_index]
            matched_sentence_count += 1
            confusion[(gold_row.coherence, pred_row.coherence)] += 1
            if gold_row.coherence == pred_row.coherence:
                agreement_count += 1
                end_to_end_tp += 1
            else:
                disagreement_count += 1
                end_to_end_fp += 1
                end_to_end_fn += 1

        end_to_end_fn += len(essay_gold_rows) - len(matched_gold_indices)
        end_to_end_fp += len(essay_pred_rows) - len(matched_pred)

    match_metrics = compute_binary_metrics(match_tp, match_fp, match_fn)
    end_to_end_metrics = compute_binary_metrics(end_to_end_tp, end_to_end_fp, end_to_end_fn)
    label_accuracy = safe_divide(agreement_count, matched_sentence_count)

    matching_summary: dict[str, str | int | float] = {
        "NUM_GOLD_SENTENCES": len(gold_rows),
        "NUM_PRED_SENTENCES": len(pred_rows),
        "MATCH_TP": match_metrics["TP"],
        "MATCH_FP": match_metrics["FP"],
        "MATCH_FN": match_metrics["FN"],
        "MATCH_PRECISION": match_metrics["PRECISION"],
        "MATCH_RECALL": match_metrics["RECALL"],
        "MATCH_F1": match_metrics["F1"],
        "EXCLUDED_GOLD_COHERENCE_ROWS": excluded_gold_rows,
        "EXCLUDED_PRED_COHERENCE_ROWS": excluded_pred_rows,
    }

    label_summary: dict[str, str | int | float] = {
        "MATCHED_SENTENCE_COUNT": matched_sentence_count,
        "AGREEMENT_COUNT": agreement_count,
        "DISAGREEMENT_COUNT": disagreement_count,
        "LABEL_ACCURACY": round_metric(label_accuracy),
        "EXCLUDED_GOLD_COHERENCE_ROWS": excluded_gold_rows,
        "EXCLUDED_PRED_COHERENCE_ROWS": excluded_pred_rows,
    }

    for gold_label in COHERENCE_LABELS:
        for pred_label in COHERENCE_LABELS:
            label_summary[
                f"GOLD_{COHERENCE_SHORT_NAMES[gold_label]}_PRED_{COHERENCE_SHORT_NAMES[pred_label]}"
            ] = confusion[(gold_label, pred_label)]

    for label in COHERENCE_LABELS:
        metrics = compute_class_metrics(confusion, label)
        short_name = COHERENCE_SHORT_NAMES[label]
        label_summary[f"{short_name}_TP"] = metrics["TP"]
        label_summary[f"{short_name}_FP"] = metrics["FP"]
        label_summary[f"{short_name}_FN"] = metrics["FN"]
        label_summary[f"{short_name}_PRECISION"] = metrics["PRECISION"]
        label_summary[f"{short_name}_RECALL"] = metrics["RECALL"]
        label_summary[f"{short_name}_F1"] = metrics["F1"]

    end_to_end_summary: dict[str, str | int | float] = {
        "NUM_GOLD_SENTENCES": len(gold_rows),
        "NUM_PRED_SENTENCES": len(pred_rows),
        "END_TO_END_TP": end_to_end_metrics["TP"],
        "END_TO_END_FP": end_to_end_metrics["FP"],
        "END_TO_END_FN": end_to_end_metrics["FN"],
        "END_TO_END_PRECISION": end_to_end_metrics["PRECISION"],
        "END_TO_END_RECALL": end_to_end_metrics["RECALL"],
        "END_TO_END_F1": end_to_end_metrics["F1"],
        "EXCLUDED_GOLD_COHERENCE_ROWS": excluded_gold_rows,
        "EXCLUDED_PRED_COHERENCE_ROWS": excluded_pred_rows,
    }

    return matching_summary, label_summary, end_to_end_summary, hallucinated_rows


def save_coherence_linguistic_matching_summary(
    model: str, summary: dict[str, str | int | float]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_coherence_linguistic_matching_summary.csv"
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summary.keys()))
        writer.writeheader()
        writer.writerow(summary)
    return output_path


def save_coherence_linguistic_label_summary(
    model: str, summary: dict[str, str | int | float]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_coherence_linguistic_label_summary.csv"
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summary.keys()))
        writer.writeheader()
        writer.writerow(summary)
    return output_path


def save_coherence_linguistic_end_to_end_summary(
    model: str, summary: dict[str, str | int | float]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_coherence_linguistic_end_to_end_summary.csv"
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summary.keys()))
        writer.writeheader()
        writer.writerow(summary)
    return output_path


def save_coherence_linguistic_hallucinations(
    model: str, rows: list[HallucinatedLinguisticCoherenceRow]
) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_coherence_linguistic_hallucinations.csv"
    fieldnames = ["ESSAY_ID", "PARA_NUM", "PRED_SENTENCE", "PRED_COHERENCE", "REASON"]
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "ESSAY_ID": row.essay_id,
                    "PARA_NUM": row.para_num,
                    "PRED_SENTENCE": row.pred_sentence,
                    "PRED_COHERENCE": row.pred_coherence,
                    "REASON": row.reason,
                }
            )
    return output_path

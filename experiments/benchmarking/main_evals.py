import argparse
import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parent
GOLD_CITATION_PATH = ROOT / "essay_ablation_coding" / "essay_citation_coding.csv"
GOLD_REFERENCE_PATH = ROOT / "essay_ablation_coding" / "essay_reference_coding.csv"
LLM_RESPONSES_DIR = ROOT / "llm_responses"
EVALUATION_RESULTS_DIR = ROOT / "evaluation_results"


@dataclass(frozen=True)
class GoldRow:
    essay_id: str
    text: str
    is_positive: bool


@dataclass(frozen=True)
class ModelRow:
    essay_id: str
    text: str


MatchFn = Callable[[str, str], bool]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, choices=["qwen3.5_2b", "bonsai_8b"])
    return parser.parse_args()


def normalize_text(text: str) -> str:
    return " ".join(text.replace("\ufeff", "").split())


def safe_divide(numerator: int | float, denominator: int | float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def load_gold_rows(path: Path, text_column: str, label_column: str) -> list[GoldRow]:
    rows: list[GoldRow] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(
                GoldRow(
                    essay_id=row["ESSAY_ID"].strip(),
                    text=row[text_column].strip(),
                    is_positive=int(row[label_column]) == 0,
                )
            )
    return rows


def load_model_rows(path: Path, text_column: str) -> list[ModelRow]:
    rows: list[ModelRow] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(
                ModelRow(
                    essay_id=row["ESSAY_ID"].strip(),
                    text=row[text_column].strip(),
                )
            )
    return rows


def match_by_containment(gold_text: str, model_text: str) -> bool:
    normalized_gold = normalize_text(gold_text)
    normalized_model = normalize_text(model_text)
    return normalized_gold in normalized_model or normalized_model in normalized_gold


def compute_metrics(tp: int, tn: int, fp: int, fn: int) -> dict[str, int | float]:
    total = tp + tn + fp + fn
    precision = safe_divide(tp, tp + fp)
    recall = safe_divide(tp, tp + fn)
    specificity = safe_divide(tn, tn + fp)
    accuracy = safe_divide(tp + tn, total)
    f1 = safe_divide(2 * precision * recall, precision + recall)
    npv = safe_divide(tn, tn + fn)
    false_positive_rate = safe_divide(fp, fp + tn)
    false_negative_rate = safe_divide(fn, fn + tp)
    balanced_accuracy = (recall + specificity) / 2

    return {
        "TP": tp,
        "TN": tn,
        "FP": fp,
        "FN": fn,
        "PRECISION": round(precision, 6),
        "RECALL": round(recall, 6),
        "SPECIFICITY": round(specificity, 6),
        "ACCURACY": round(accuracy, 6),
        "F1": round(f1, 6),
        "NPV": round(npv, 6),
        "FPR": round(false_positive_rate, 6),
        "FNR": round(false_negative_rate, 6),
        "BALANCED_ACCURACY": round(balanced_accuracy, 6),
    }


def evaluate_binary_benchmark(
    benchmark_type: str,
    gold_rows: list[GoldRow],
    model_rows: list[ModelRow],
    match_fn: MatchFn,
) -> dict[str, str | int | float]:
    gold_by_essay: dict[str, list[GoldRow]] = {}
    model_by_essay: dict[str, list[ModelRow]] = {}

    for row in gold_rows:
        gold_by_essay.setdefault(row.essay_id, []).append(row)
    for row in model_rows:
        model_by_essay.setdefault(row.essay_id, []).append(row)

    tp = 0
    tn = 0
    fp = 0
    fn = 0

    for gold_row in gold_rows:
        essay_predictions = model_by_essay.get(gold_row.essay_id, [])
        predicted_positive = any(
            match_fn(gold_row.text, model_row.text)
            for model_row in essay_predictions
        )

        if gold_row.is_positive:
            if predicted_positive:
                tp += 1
            else:
                fn += 1
        else:
            if predicted_positive:
                fp += 1
            else:
                tn += 1

    for model_row in model_rows:
        essay_gold_rows = gold_by_essay.get(model_row.essay_id, [])
        matched_gold_row = next(
            (gold_row for gold_row in essay_gold_rows if match_fn(gold_row.text, model_row.text)),
            None,
        )
        if matched_gold_row is None:
            fp += 1

    result: dict[str, str | int | float] = {"BENCHMARK_TYPE": benchmark_type}
    result.update(compute_metrics(tp, tn, fp, fn))
    return result


def citation_no_reference(model: str) -> dict[str, str | int | float]:
    response_path = LLM_RESPONSES_DIR / f"citations_no_references_{model}.csv"
    gold_rows = load_gold_rows(
        GOLD_CITATION_PATH,
        text_column="SENTENCE_WITH_CITATION",
        label_column="CORRESPONDING_REFERENCE",
    )
    model_rows = load_model_rows(response_path, text_column="CITATION")
    return evaluate_binary_benchmark(
        benchmark_type="citation_no_reference",
        gold_rows=gold_rows,
        model_rows=model_rows,
        match_fn=match_by_containment,
    )


def reference_no_citation(model: str) -> dict[str, str | int | float]:
    response_path = LLM_RESPONSES_DIR / f"reference_has_no_citations_{model}.csv"
    gold_rows = load_gold_rows(
        GOLD_REFERENCE_PATH,
        text_column="REFERENCE",
        label_column="CORRESPONDING_CITATION",
    )
    model_rows = load_model_rows(response_path, text_column="REFERENCE")
    return evaluate_binary_benchmark(
        benchmark_type="reference_no_citation",
        gold_rows=gold_rows,
        model_rows=model_rows,
        match_fn=match_by_containment,
    )


def save_results(model: str, results: list[dict[str, str | int | float]]) -> Path:
    EVALUATION_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = EVALUATION_RESULTS_DIR / f"{model}_benchmark_evals.csv"

    existing_rows: list[dict[str, str]] = []
    if output_path.exists():
        with output_path.open("r", encoding="utf-8-sig", newline="") as handle:
            existing_rows = list(csv.DictReader(handle))

    fieldnames = list(results[0].keys())
    new_rows_by_type = {
        str(result["BENCHMARK_TYPE"]): {key: str(value) for key, value in result.items()}
        for result in results
    }

    filtered_rows = [
        row
        for row in existing_rows
        if row.get("BENCHMARK_TYPE") not in new_rows_by_type
    ]
    filtered_rows.extend(new_rows_by_type.values())

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(filtered_rows)

    return output_path


def main() -> None:
    args = parse_args()
    results = [
        citation_no_reference(args.model),
        reference_no_citation(args.model),
    ]
    output_path = save_results(args.model, results)
    print(f"Saved benchmark results to {output_path}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
import re
from typing import Callable


ROOT = Path(__file__).resolve().parent.parent
GOLD_CITATION_PATH = ROOT / "essay_ablation_coding" / "essay_citation_coding.csv"
GOLD_REFERENCE_PATH = ROOT / "essay_ablation_coding" / "essay_reference_coding.csv"
GOLD_IDENTIFY_PARAGRAPHS_PATH = ROOT / "essay_ablation_coding" / "identify_essay_coding.csv"
GOLD_ALL_SENTENCES_PATH = ROOT / "essay_ablation_coding" / "essay_ablation_all_sentences.csv"
GENERATED_ESSAYS_ABLATED_DIR = ROOT.parent / "generated_essays_ablated"
LLM_RESPONSES_DIR = ROOT / "llm_responses"
EVALUATION_RESULTS_DIR = ROOT / "evaluation_results"
REFERENCE_ALMOST_MATCH_F1_THRESHOLD = 0.85
IDENTIFY_PARA_TYPES = (
    "introduction",
    "body paragraph 1",
    "body paragraph 2",
    "body paragraph 3",
    "conclusion",
    "references",
)
ALMOST_MATCH_F1_THRESHOLD = 0.9


@dataclass(frozen=True)
class GoldRow:
    essay_id: str
    text: str
    is_positive: bool


@dataclass(frozen=True)
class ModelRow:
    essay_id: str
    text: str


@dataclass(frozen=True)
class IdentifyParagraphRow:
    essay_id: str
    para_type: str
    paragraph: str


@dataclass(frozen=True)
class IdentifyParagraphComparisonRow:
    essay_id: str
    row_index: int
    gold_para_type: str
    predicted_para_type: str
    gold_paragraph: str
    predicted_paragraph: str
    token_f1: float
    exact_match: int
    almost_match: int
    unmatched: int
    classify_paragraph_correct: int


@dataclass(frozen=True)
class EssaySentenceRow:
    essay_id: str
    section_type: str
    row_index: int
    sentence: str


@dataclass(frozen=True)
class HallucinatedSentenceRow:
    essay_id: str
    hallucinated_sentence: str


@dataclass(frozen=True)
class DuplicatedCitationRow:
    essay_id: str
    duplicated_sentence: str


@dataclass(frozen=True)
class HallucinatedReferenceRow:
    essay_id: str
    hallucinated_reference: str


MatchFn = Callable[[str, str], bool]
SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+(?=(?:["“‘\'*()]*[A-Z0-9]))')
ABBREVIATIONS = (
    "U.S.",
    "U.K.",
    "n.d.",
    "et al.",
    "e.g.",
    "i.e.",
    "Mr.",
    "Mrs.",
    "Ms.",
    "Dr.",
    "Prof.",
    "St.",
    "vs.",
)


def normalize_text(text: str) -> str:
    return " ".join(text.replace("\ufeff", "").split())


def normalize_reference_text(text: str) -> str:
    normalized = normalize_text(text)
    normalized = (
        normalized.replace("*", "")
        .replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
        .replace("–", "-")
        .replace("—", "-")
    )
    normalized = re.sub(r"\s+([,.;:!?])", r"\1", normalized)
    normalized = re.sub(r"([(\[])\s+", r"\1", normalized)
    normalized = re.sub(r'\s+([)\]"])', r"\1", normalized)
    return " ".join(normalized.split())


def safe_divide(numerator: int | float, denominator: int | float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def round_metric(value: float) -> float:
    return round(value, 6)


def protect_abbreviations(text: str) -> tuple[str, dict[str, str]]:
    replacements: dict[str, str] = {}
    protected_text = text
    for index, abbreviation in enumerate(ABBREVIATIONS):
        placeholder = f"__ABBR_{index}__"
        replacements[placeholder] = abbreviation
        protected_text = protected_text.replace(abbreviation, placeholder)
    return protected_text, replacements


def restore_abbreviations(text: str, replacements: dict[str, str]) -> str:
    restored_text = text
    for placeholder, abbreviation in replacements.items():
        restored_text = restored_text.replace(placeholder, abbreviation)
    return restored_text


def split_into_sentences(text: str) -> list[str]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    protected, replacements = protect_abbreviations(normalized)
    sentences = [restore_abbreviations(part.strip(), replacements) for part in SENTENCE_SPLIT_RE.split(protected)]
    return [sentence for sentence in sentences if sentence]


def is_metadata_block(block: str) -> bool:
    text = normalize_text(block)
    if not text:
        return True
    if "Daniel Parsons" in text and ("Std Num:" in text or re.search(r"\bJune \d{1,2}(st|nd|rd|th)?\b", text)):
        return True
    lines = [line.strip() for line in block.splitlines() if line.strip()]
    if lines and all(is_reference_metadata_block(line) for line in lines):
        return True
    if text.startswith(("# ", "## ", "### ")):
        return True
    if text.startswith(
        (
            "Student Name:",
            "Number:",
            "Date:",
            "Essay by ",
            "Name:",
            "Written by ",
            "Word Count:",
            "Std Num:",
        )
    ):
        return True
    if text == "Daniel Parsons":
        return True
    if re.fullmatch(r"[A-Z][a-z]+ \d{1,2}(st|nd|rd|th)?(?:, \d{4})?", text):
        return True
    if "\n" not in block and not re.search(r"[.!?]$", text):
        return True
    return False


def is_reference_metadata_block(block: str) -> bool:
    lines = [line.strip() for line in block.splitlines() if line.strip()]
    if not lines:
        return True

    for line in lines:
        normalized_line = normalize_text(line)
        if normalized_line.startswith(
            (
                "Student Name:",
                "Number:",
                "Date:",
                "Essay by ",
                "Name:",
                "Written by ",
                "Word Count:",
                "Std Num:",
            )
        ):
            continue
        if normalized_line == "Daniel Parsons":
            continue
        if re.fullmatch(r"[A-Z][a-z]+ \d{1,2}(st|nd|rd|th)?(?:, \d{4})?", normalized_line):
            continue
        return False

    return True


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


def load_identify_paragraph_rows(path: Path) -> list[IdentifyParagraphRow]:
    rows: list[IdentifyParagraphRow] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(
                IdentifyParagraphRow(
                    essay_id=row["ESSAY_ID"].strip(),
                    para_type=row["PARA_TYPE"].strip(),
                    paragraph=row["PARAGRAPH"].strip(),
                )
            )
    return rows


def load_essay_sentence_rows(path: Path) -> list[EssaySentenceRow]:
    rows: list[EssaySentenceRow] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(
                EssaySentenceRow(
                    essay_id=row["ESSAY_ID"].strip(),
                    section_type=row["SECTION_TYPE"].strip(),
                    row_index=int(row["ROW_INDEX"]),
                    sentence=row["SENTENCE"].strip(),
                )
            )
    return rows


def match_by_containment(gold_text: str, model_text: str) -> bool:
    normalized_gold = normalize_text(gold_text)
    normalized_model = normalize_text(model_text)
    return normalized_gold in normalized_model or normalized_model in normalized_gold


def tokenize(text: str) -> list[str]:
    return normalize_text(text).split()


def tokenize_reference(text: str) -> list[str]:
    return normalize_reference_text(text).split()


def token_level_f1(gold_text: str, model_text: str) -> float:
    gold_tokens = tokenize(gold_text)
    model_tokens = tokenize(model_text)
    if not gold_tokens and not model_tokens:
        return 1.0
    if not gold_tokens or not model_tokens:
        return 0.0

    gold_counts: dict[str, int] = {}
    for token in gold_tokens:
        gold_counts[token] = gold_counts.get(token, 0) + 1

    overlap = 0
    for token in model_tokens:
        remaining = gold_counts.get(token, 0)
        if remaining > 0:
            overlap += 1
            gold_counts[token] = remaining - 1

    precision = safe_divide(overlap, len(model_tokens))
    recall = safe_divide(overlap, len(gold_tokens))
    return safe_divide(2 * precision * recall, precision + recall)


def reference_token_level_f1(gold_text: str, model_text: str) -> float:
    gold_tokens = tokenize_reference(gold_text)
    model_tokens = tokenize_reference(model_text)

    if not gold_tokens and not model_tokens:
        return 1.0
    if not gold_tokens or not model_tokens:
        return 0.0

    gold_counts: dict[str, int] = {}
    for token in gold_tokens:
        gold_counts[token] = gold_counts.get(token, 0) + 1

    overlap = 0
    for token in model_tokens:
        remaining = gold_counts.get(token, 0)
        if remaining > 0:
            overlap += 1
            gold_counts[token] = remaining - 1

    precision = safe_divide(overlap, len(model_tokens))
    recall = safe_divide(overlap, len(gold_tokens))
    return safe_divide(2 * precision * recall, precision + recall)


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
        "PRECISION": round_metric(precision),
        "RECALL": round_metric(recall),
        "SPECIFICITY": round_metric(specificity),
        "ACCURACY": round_metric(accuracy),
        "F1": round_metric(f1),
        "NPV": round_metric(npv),
        "FPR": round_metric(false_positive_rate),
        "FNR": round_metric(false_negative_rate),
        "BALANCED_ACCURACY": round_metric(balanced_accuracy),
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

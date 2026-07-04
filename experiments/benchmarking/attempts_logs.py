import csv
from pathlib import Path
from append_to_csv import append_to_csv


def ensure_csv_schema(csv_dir, csv_filename, columns):
    csv_path = Path(csv_dir) / csv_filename
    if not csv_path.exists() or csv_path.stat().st_size == 0:
        return

    with csv_path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        existing_columns = reader.fieldnames or []
        if existing_columns == columns:
            return
        existing_rows = list(reader)

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for row in existing_rows:
            writer.writerow({column: row.get(column, "") for column in columns})

def append_attempt_log(
        essay_id,
        paragraph_num,
        sentence_num,
        csv_file_append,
        attempt_count,
        passed,
        failure_reason,
        benchmark_type,
        elapsed_ms,
        emissions_kg,
        completion_tokens,
        prompt_tokens,
        total_tokens,
        tokens_per_second,
        predicted_tokens_per_second,
        prompt_tokens_per_second,
):
    csv_dir = "experiments/benchmarking/llm_responses/attempt_logs"
    csv_filename = f"attempt_logs_{csv_file_append}.csv"
    columns = [
        "ESSAY_ID",
        "PARAGRAPH_NUM",
        "SENTENCE_NUM",
        "ATTEMPTS_USED",
        "PASSED_VALIDATION",
        "FAILURE_REASON",
        "BENCHMARK_TYPE",
        "ELAPSED_MS",
        "EMISSIONS_KG",
        "COMPLETION_TOKENS",
        "PROMPT_TOKENS",
        "TOTAL_TOKENS",
        "TOKENS_PER_SECOND",
        "PREDICTED_TOKENS_PER_SECOND",
        "PROMPT_TOKENS_PER_SECOND",
    ]

    ensure_csv_schema(csv_dir, csv_filename, columns)
    append_to_csv(
        csv_dir,
        csv_filename,
        columns,
        [
            essay_id,
            paragraph_num,
            sentence_num,
            attempt_count,
            "yes" if passed else "no",
            failure_reason,
            benchmark_type,
            elapsed_ms,
            emissions_kg,
            completion_tokens,
            prompt_tokens,
            total_tokens,
            tokens_per_second,
            predicted_tokens_per_second,
            prompt_tokens_per_second,
        ]
    )

def append_identify_paragraphs_attempt_log(
    essay_id,
    csv_file_append,
    attempt_count,
    passed,
    failure_reason
):
    append_to_csv(
        "experiments/benchmarking/llm_responses/attempts_logs",
        f"identify_paragraphs_attempts_{csv_file_append}.csv",
        ["ESSAY_ID", "ATTEMPTS_USED", "PASSED_VALIDATION", "FAILURE_REASON"],
        [
            essay_id,
            attempt_count,
            "yes" if passed else "no",
            failure_reason
        ]
    )

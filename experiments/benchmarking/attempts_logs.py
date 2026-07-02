
from append_to_csv import append_to_csv

def append_attempt_log(
        essay_id,
        paragraph_num,
        sentence_num,
        csv_file_append,
        attempt_count,
        passed,
        failure_reason,
        benchmark_type
):
    append_to_csv(
        "experiments/benchmarking/llm_responses/attempt_logs",
        f"attempt_logs_{csv_file_append}.csv",
        ["ESSAY_ID", "PARAGRAPH_NUM", "SENTENCE_NUM", "ATTEMPTS_USED", "PASSED_VALIDATION", "FAILURE_REASON", "BENCHMARK_TYPE"],
        [
            essay_id,
            paragraph_num,
            sentence_num,
            attempt_count,
            "yes" if passed else "no",
            failure_reason,
            benchmark_type
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
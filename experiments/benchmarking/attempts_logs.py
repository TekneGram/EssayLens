
from append_to_csv import append_to_csv

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

def append_identify_citations_attempt_log(
        essay_id,
        csv_file_append,
        attempt_count,
        passed,
        failure_reason
):
    append_to_csv(
        "experiments/benchmarking.llm_responses/attempt/logs",
        f"identify_citations_attempts_{csv_file_append}.csv",
        ["ESSAY_ID", "ATTEMPTS_USED", "PASSED_VALIDATION", "FAILURE_REASON"],
        [
            essay_id,
            attempt_count,
            "yes" if passed else "no",
            failure_reason
        ]
    )
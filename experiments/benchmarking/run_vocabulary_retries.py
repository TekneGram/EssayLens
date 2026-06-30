import json
from attempts_logs import append_attempt_log
from validators.validate_vocabulary import validate_enhance_vocabulary
from essay_analysis_vocabulary import enhance_vocabulary
MAX_ATTEMPTS = 6

def run_enhance_vocabulary_with_retries(
        essay,
        essay_id,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="enrich_vocabulary"

    for attempt in range(1, max_attempts + 1):
        try:
            conc_analysis = enhance_vocabulary(
                essay,
                "experiments/tasks_vocabulary/vocabulary_enrichment_knowledge.md",
                "experiments/tasks_vocabulary/vocabulary_enrichment_tasks.md",
                base_url,
                max_tokens,
                temp
            )

            conc_analysis_data = conc_analysis["choices"][0]["message"]["content"]
            conc_analysis_data = json.loads(conc_analysis_data)
            validated = validate_enhance_vocabulary(conc_analysis_data)

            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=True,
                failure_reason="",
                benchmark_type=BENCHMARK_TYPE
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "vocabulary_data": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE
            )
    return {
        "passed": False,
        "attempts_used": max_attempts,
        "vocabulary_data": None,
        "failure_reason": last_error
    }
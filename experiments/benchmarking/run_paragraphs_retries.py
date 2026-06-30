import json
from attempts_logs import append_attempt_log
from validators.validate_paragraphs import validate_encourage_development, validate_anything_unclear
from essay_analysis_paragraphs import encourage_development, anything_unclear
MAX_ATTEMPTS = 6


def run_encourage_development_with_retries(
        essay,
        essay_id,
        bp,
        para_num,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="paragraph_encourage_development"

    for attempt in range(1, max_attempts + 1):
        try:
            encouragement = encourage_development(
                essay,
                bp,
                "experiments/tasks_paragraphs/paragraphs_knowledge.md",
                "experiments/tasks_paragraphs/encourage_development.md",
                base_url,
                max_tokens,
                temp
            )

            encouragement_data = encouragement["choices"][0]["message"]["content"]
            encouragement_data = json.loads(encouragement_data)
            validated = validate_encourage_development(encouragement_data)

            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
                "paragraph_data": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
        "paragraph_data": None,
        "failure_reason": last_error
    }



def run_anything_unclear_with_retries(
        essay,
        essay_id,
        bp,
        para_num,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="paragraph_anything_unclear"

    for attempt in range(1, max_attempts + 1):
        try:
            unclear_points = anything_unclear(
                essay,
                bp,
                "experiments/tasks_paragraphs/paragraphs_knowledge.md",
                "experiments/tasks_paragraphs/seek_clarity.md",
                base_url,
                max_tokens,
                temp
            )

            unclear_points_data = unclear_points["choices"][0]["message"]["content"]
            unclear_points_data = json.loads(unclear_points_data)
            validated = validate_anything_unclear(unclear_points_data)

            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
                "paragraph_data": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
        "paragraph_data": None,
        "failure_reason": last_error
    }
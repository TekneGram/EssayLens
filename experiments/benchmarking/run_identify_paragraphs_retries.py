import json
from essay_analysis_all_paragraphs import identify_paragraphs
from attempts_logs import append_identify_paragraphs_attempt_log
from validators import validate_identify_paragraphs_shape

MAX_IDENTIFY_PARAGRAPHS_ATTEMPTS = 6

def run_identify_paragraphs_with_retries(
        essay,
        essay_id,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts = MAX_IDENTIFY_PARAGRAPHS_ATTEMPTS
):
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            identified_paragraphs = identify_paragraphs(
                essay,
                "experiments/tasks_all_paragraphs/essay_knowledge.md",
                "experiments/tasks_all_paragraphs/identify_paragraphs_references.md",
                base_url,
                max_tokens,
                temp,
            )

            content = identified_paragraphs["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            validated = validate_identify_paragraphs_shape(parsed)
            append_identify_paragraphs_attempt_log(
                essay_id=essay_id,
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=True,
                failure_reason=""
            )
            return {
                "passed": True,
                "attempts_used": attempt,
                "essay_paragraphs": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)

    append_identify_paragraphs_attempt_log(
        essay_id=essay_id,
        csv_file_append=csv_file_append,
        attempt_count = max_attempts,
        passed=False,
        failure_reason=last_error,
    )

    return {
        "passed": False,
        "attempts_used": max_attempts,
        "essay_paragraphs": None,
        "failure_reason": last_error,
    }
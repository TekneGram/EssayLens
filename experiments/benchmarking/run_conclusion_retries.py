import json
from attempts_logs import append_attempt_log
from validators.validate_conclusion import validate_anaylze_conclusions, validate_provide_conclusion_feedback
from essay_analysis_conclusions import analyze_conclusions, provide_conclusion_feedback
MAX_ATTEMPTS = 6

def run_analyze_conclusions_with_retries(
        essay,
        essay_id,
        conclusion,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="analyze_conclusion"

    for attempt in range(1, max_attempts + 1):
        try:
            conc_analysis = analyze_conclusions(
                essay,
                conclusion,
                "experiments/tasks_conclusions/conclusions_knowledge.md",
                "experiments/tasks_conclusions/analyze_conclusion.md",
                base_url,
                max_tokens,
                temp
            )

            conc_analysis_data = conc_analysis["choices"][0]["message"]["content"]
            conc_analysis_data = json.loads(conc_analysis_data)
            validated = validate_anaylze_conclusions(conc_analysis_data)

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
                "conclusion_data": validated,
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
        "conclusion_data": None,
        "failure_reason": last_error
    }

def run_provide_conclusion_feedback_with_retries(
        essay,
        essay_id,
        conclusion,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="provide_conclusion_feedback"

    for attempt in range(1, max_attempts + 1):
        try:
            conc_feedback = provide_conclusion_feedback(
                essay,
                conclusion,
                "experiments/tasks_conclusions/conclusions_knowledge.md",
                "experiments/tasks_conclusions/conclusion_feedback.md",
                base_url,
                max_tokens,
                temp
            )

            conc_feedback_data = conc_feedback["choices"][0]["message"]["content"]
            conc_feedback_data = json.loads(conc_feedback_data)
            validated = validate_anaylze_conclusions(conc_feedback_data)

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
                "conclusion_data": validated,
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
        "conclusion_data": None,
        "failure_reason": last_error
    }
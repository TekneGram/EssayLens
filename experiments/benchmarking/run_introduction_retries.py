import json
from attempts_logs import append_attempt_log
from validators.validate_introduction import validate_analyze_gen_spec, validate_introduction_feedback
from essay_analysis_introductions import analyze_gen_spec, provide_introduction_feedback
MAX_ATTEMPTS = 6

def run_analyze_gen_spec_with_retries(
        essay,
        essay_id,
        introduction,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="analyze_gen_spec"

    for attempt in range(1, max_attempts + 1):
        try:
            gen_spec = analyze_gen_spec(
                essay,
                introduction,
                "experiments/tasks_introductions/introductions_knowledge.md",
                "experiments/tasks_introductions/analyze_gen_spec.md",
                base_url,
                max_tokens,
                temp
            )

            gen_spec_data = gen_spec["choices"][0]["message"]["content"]
            gen_spec_data = json.loads(gen_spec_data)
            validated = validate_analyze_gen_spec(gen_spec_data)

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
                "introduction_data": validated,
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
        "introduction_data": None,
        "failure_reason": last_error
    }

def run_provide_introduction_feedback_with_retries(
        essay,
        essay_id,
        introduction,
        gen_spec_content,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="provide_introduction_feedback"

    for attempt in range(1, max_attempts + 1):
        try:
            feedback = provide_introduction_feedback(
                essay,
                introduction,
                gen_spec_content,
                "experiments/tasks_introductions/introductions_knowledge.md",
                "experiments/tasks_introductions/introductions_feedback.md",
                base_url,
                max_tokens,
                temp
            )

            feedback_data = feedback["choices"][0]["message"]["content"]
            feedback_data = json.loads(feedback_data)
            validated = validate_analyze_gen_spec(feedback_data)

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
                "introduction_data": validated,
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
        "introduction_data": None,
        "failure_reason": last_error
    }
import json
import requests
from attempts_logs import append_attempt_log
from timing_utils import call_with_timer_ms, extract_response_metrics
from validators.validate_introduction import validate_analyze_gen_spec, validate_introduction_feedback
from essay_analysis_introductions import analyze_gen_spec, provide_introduction_feedback
from request_timeout_utils import DEFAULT_REQUEST_TIMEOUT, format_timeout_failure
MAX_ATTEMPTS = 6

def run_analyze_gen_spec_with_retries(
        essay,
        essay_id,
        introduction,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        request_timeout=DEFAULT_REQUEST_TIMEOUT,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="analyze_gen_spec"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        response_metrics = extract_response_metrics(None, elapsed_ms)
        try:
            gen_spec, elapsed_ms, emissions_kg = call_with_timer_ms(
                analyze_gen_spec,
                essay,
                introduction,
                "experiments/tasks_introductions/introductions_knowledge.md",
                "experiments/tasks_introductions/analyze_gen_spec.md",
                base_url,
                max_tokens,
                temp,
                sampling_params,
                request_timeout,
            )
            response_metrics = extract_response_metrics(gen_spec, elapsed_ms)

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
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
                completion_tokens=response_metrics["completion_tokens"],
                prompt_tokens=response_metrics["prompt_tokens"],
                total_tokens=response_metrics["total_tokens"],
                tokens_per_second=response_metrics["tokens_per_second"],
                predicted_tokens_per_second=response_metrics["predicted_tokens_per_second"],
                prompt_tokens_per_second=response_metrics["prompt_tokens_per_second"],
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "introduction_data": validated,
                "failure_reason": None
            }
        except requests.exceptions.Timeout as exc:
            elapsed_ms = getattr(exc, "elapsed_ms", elapsed_ms)
            emissions_kg = getattr(exc, "emissions_kg", emissions_kg)
            last_error = format_timeout_failure(BENCHMARK_TYPE, essay_id, "", request_timeout, exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
                completion_tokens=response_metrics["completion_tokens"],
                prompt_tokens=response_metrics["prompt_tokens"],
                total_tokens=response_metrics["total_tokens"],
                tokens_per_second=response_metrics["tokens_per_second"],
                predicted_tokens_per_second=response_metrics["predicted_tokens_per_second"],
                prompt_tokens_per_second=response_metrics["prompt_tokens_per_second"],
            )
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            elapsed_ms = getattr(exc, "elapsed_ms", elapsed_ms)
            emissions_kg = getattr(exc, "emissions_kg", emissions_kg)
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
                completion_tokens=response_metrics["completion_tokens"],
                prompt_tokens=response_metrics["prompt_tokens"],
                total_tokens=response_metrics["total_tokens"],
                tokens_per_second=response_metrics["tokens_per_second"],
                predicted_tokens_per_second=response_metrics["predicted_tokens_per_second"],
                prompt_tokens_per_second=response_metrics["prompt_tokens_per_second"],
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
        sampling_params,
        request_timeout=DEFAULT_REQUEST_TIMEOUT,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="provide_introduction_feedback"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        response_metrics = extract_response_metrics(None, elapsed_ms)
        try:
            feedback, elapsed_ms, emissions_kg = call_with_timer_ms(
                provide_introduction_feedback,
                essay,
                introduction,
                gen_spec_content,
                "experiments/tasks_introductions/introductions_knowledge.md",
                "experiments/tasks_introductions/introductions_feedback.md",
                base_url,
                max_tokens,
                temp,
                sampling_params,
                request_timeout,
            )
            response_metrics = extract_response_metrics(feedback, elapsed_ms)

            feedback_data = feedback["choices"][0]["message"]["content"]
            feedback_data = json.loads(feedback_data)
            validated = validate_introduction_feedback(feedback_data)

            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=True,
                failure_reason="",
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
                completion_tokens=response_metrics["completion_tokens"],
                prompt_tokens=response_metrics["prompt_tokens"],
                total_tokens=response_metrics["total_tokens"],
                tokens_per_second=response_metrics["tokens_per_second"],
                predicted_tokens_per_second=response_metrics["predicted_tokens_per_second"],
                prompt_tokens_per_second=response_metrics["prompt_tokens_per_second"],
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "introduction_data": validated,
                "failure_reason": None
            }
        except requests.exceptions.Timeout as exc:
            elapsed_ms = getattr(exc, "elapsed_ms", elapsed_ms)
            emissions_kg = getattr(exc, "emissions_kg", emissions_kg)
            last_error = format_timeout_failure(BENCHMARK_TYPE, essay_id, "", request_timeout, exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
                completion_tokens=response_metrics["completion_tokens"],
                prompt_tokens=response_metrics["prompt_tokens"],
                total_tokens=response_metrics["total_tokens"],
                tokens_per_second=response_metrics["tokens_per_second"],
                predicted_tokens_per_second=response_metrics["predicted_tokens_per_second"],
                prompt_tokens_per_second=response_metrics["prompt_tokens_per_second"],
            )
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            elapsed_ms = getattr(exc, "elapsed_ms", elapsed_ms)
            emissions_kg = getattr(exc, "emissions_kg", emissions_kg)
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
                completion_tokens=response_metrics["completion_tokens"],
                prompt_tokens=response_metrics["prompt_tokens"],
                total_tokens=response_metrics["total_tokens"],
                tokens_per_second=response_metrics["tokens_per_second"],
                predicted_tokens_per_second=response_metrics["predicted_tokens_per_second"],
                prompt_tokens_per_second=response_metrics["prompt_tokens_per_second"],
            )
    return {
        "passed": False,
        "attempts_used": max_attempts,
        "introduction_data": None,
        "failure_reason": last_error
    }

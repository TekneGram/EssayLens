import json
from essay_analysis_all_paragraphs import identify_paragraphs
from attempts_logs import append_attempt_log
from timing_utils import call_with_timer_ms, extract_response_metrics
from validators.validate_identify_paragraphs import validate_identify_paragraphs_shape

MAX_IDENTIFY_PARAGRAPHS_ATTEMPTS = 6

def run_identify_paragraphs_with_retries(
        essay,
        essay_id,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        max_attempts = MAX_IDENTIFY_PARAGRAPHS_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="identify_paragraphs"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        response_metrics = extract_response_metrics(None, elapsed_ms)
        try:
            identified_paragraphs, elapsed_ms, emissions_kg = call_with_timer_ms(
                identify_paragraphs,
                essay,
                "experiments/tasks_all_paragraphs/essay_knowledge.md",
                "experiments/tasks_all_paragraphs/identify_paragraphs_references.md",
                base_url,
                max_tokens,
                temp,
                sampling_params
            )
            response_metrics = extract_response_metrics(identified_paragraphs, elapsed_ms)

            content = identified_paragraphs["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            validated = validate_identify_paragraphs_shape(parsed)
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
                "essay_paragraphs": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            elapsed_ms = getattr(exc, "elapsed_ms", elapsed_ms)
            emissions_kg = getattr(exc, "emissions_kg", emissions_kg)
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num="",
                sentence_num="",
                csv_file_append=csv_file_append,
                attempt_count = attempt,
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
        "essay_paragraphs": None,
        "failure_reason": last_error,
    }

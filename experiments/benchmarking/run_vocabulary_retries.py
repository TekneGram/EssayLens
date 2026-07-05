import json
import requests
from attempts_logs import append_attempt_log
from timing_utils import call_with_timer_ms, extract_response_metrics
from validators.validate_vocabulary import validate_enhance_vocabulary
from essay_analysis_vocabulary import enhance_vocabulary
from request_timeout_utils import DEFAULT_REQUEST_TIMEOUT, format_timeout_failure
MAX_ATTEMPTS = 6

def run_enhance_vocabulary_with_retries(
        essay,
        essay_id,
        word_list,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        request_timeout=DEFAULT_REQUEST_TIMEOUT,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="enrich_vocabulary"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        response_metrics = extract_response_metrics(None, elapsed_ms)
        try:
            conc_analysis, elapsed_ms, emissions_kg = call_with_timer_ms(
                enhance_vocabulary,
                essay,
                "experiments/tasks_vocabulary/vocabulary_enrichment_knowledge.md",
                word_list,
                "experiments/tasks_vocabulary/vocabulary_enrichment_task.md",
                base_url,
                max_tokens,
                temp,
                sampling_params,
                request_timeout,
            )
            response_metrics = extract_response_metrics(conc_analysis, elapsed_ms)

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
                "vocabulary_data": validated,
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
        "vocabulary_data": None,
        "failure_reason": last_error
    }

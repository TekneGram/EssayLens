import json
from attempts_logs import append_attempt_log
from timing_utils import call_with_timer_ms, extract_response_metrics
from validators.validate_coherence import validate_analyze_topic_sentence_coherence, validate_analyze_pronouns, validate_analyze_linguistic_coherence
from essay_analysis_coherence import analyze_topic_sentence_coherence, analyze_pronouns, analyze_linguistic_coherence
MAX_ATTEMPTS = 6

def run_analyze_topic_sentence_coherence_with_retries(
        bp,
        essay_id,
        para_num,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="topic_sentence_coherence_unity"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        response_metrics = extract_response_metrics(None, elapsed_ms)
        try:
            ts_coh, elapsed_ms, emissions_kg = call_with_timer_ms(
                analyze_topic_sentence_coherence,
                bp,
                "experiments/tasks_body_paras/topic_sentence_coherence_knowledge.md",
                "experiments/tasks_body_paras/body_coherence_with_topic.md",
                base_url,
                max_tokens,
                temp,
                sampling_params,
            )
            response_metrics = extract_response_metrics(ts_coh, elapsed_ms)

            ts_coh_data = ts_coh["choices"][0]["message"]["content"]
            ts_coh_data = json.loads(ts_coh_data)
            validated = validate_analyze_topic_sentence_coherence(ts_coh_data)

            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
                "coherence_data": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            elapsed_ms = getattr(exc, "elapsed_ms", elapsed_ms)
            emissions_kg = getattr(exc, "emissions_kg", emissions_kg)
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
        "coherence_data": None,
        "failure_reason": last_error
    }

def run_analyze_pronouns_with_retries(
        bp,
        essay_id,
        para_num,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="pronoun_coherence"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        response_metrics = extract_response_metrics(None, elapsed_ms)
        try:
            pronouns, elapsed_ms, emissions_kg = call_with_timer_ms(
                analyze_pronouns,
                bp,
                "experiments/tasks_body_paras/pronoun_coherence_knowledge.md",
                "experiments/tasks_body_paras/improve_pronouns.md",
                base_url,
                max_tokens,
                temp,
                sampling_params
            )
            response_metrics = extract_response_metrics(pronouns, elapsed_ms)

            pronouns_data = pronouns["choices"][0]["message"]["content"]
            pronouns_data = json.loads(pronouns_data)
            validated = validate_analyze_pronouns(pronouns_data)

            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
                "coherence_data": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            elapsed_ms = getattr(exc, "elapsed_ms", elapsed_ms)
            emissions_kg = getattr(exc, "emissions_kg", emissions_kg)
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
        "coherence_data": None,
        "failure_reason": last_error
    }

def run_analyze_linguistic_coherence_with_retries(
        bp,
        essay_id,
        para_num,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="linguistic_coherence"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        response_metrics = extract_response_metrics(None, elapsed_ms)
        try:
            ling_coh, elapsed_ms, emissions_kg = call_with_timer_ms(
                analyze_linguistic_coherence,
                bp,
                "experiments/tasks_body_paras/linguistic_coherence_knowledge.md",
                "experiments/tasks_body_paras/identify_linguistic_coherence_improvements.md",
                base_url,
                max_tokens,
                temp,
                sampling_params
            )
            response_metrics = extract_response_metrics(ling_coh, elapsed_ms)

            ling_coh_data = ling_coh["choices"][0]["message"]["content"]
            ling_coh_data = json.loads(ling_coh_data)
            validated = validate_analyze_linguistic_coherence(ling_coh_data)

            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
                "coherence_data": validated,
                "failure_reason": None
            }
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
            elapsed_ms = getattr(exc, "elapsed_ms", elapsed_ms)
            emissions_kg = getattr(exc, "emissions_kg", emissions_kg)
            last_error = str(exc)
            append_attempt_log(
                essay_id=essay_id,
                paragraph_num=para_num,
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
        "coherence_data": None,
        "failure_reason": last_error
    }

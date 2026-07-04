import json
from attempts_logs import append_attempt_log
from timing_utils import call_with_timer_ms
from validators.validate_thesis import validate_determine_thesis_statement_shape, validate_thesis_statement_characteristics_shape, validate_thesis_statement_comment, validate_thesis_statement_advice_shape, validate_thesis_statement_heap_praise
from essay_analysis_thesis import determine_thesis_statement, thesis_statement_characteristics, thesis_statement_advice, thesis_statement_comment, thesis_statement_heap_praise
MAX_ATTEMPTS = 6

def run_determine_thesis_statement_with_retries(
    essay,
    essay_id,
    introduction,
    base_url,
    max_tokens,
    temp,
    csv_file_append,
    sampling_params,
    max_attempts = MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="determine_thesis_statement"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        try:
            thesis_statement, elapsed_ms, emissions_kg = call_with_timer_ms(
                determine_thesis_statement,
                essay,
                "experiments/tasks_thesis/essay_knowledge_determine_thesis.md",
                introduction,
                "experiments/tasks_thesis/essay_determine_thesis.md",
                base_url,
                max_tokens,
                temp,
                sampling_params
            )

            thesis_statement_data = thesis_statement["choices"][0]["message"]["content"]
            thesis_statement_data = json.loads(thesis_statement_data)
            validated = validate_determine_thesis_statement_shape(thesis_statement_data)

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
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "thesis_data": validated,
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
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
            )
    return {
        "passed": False,
        "attempts_used": max_attempts,
        "thesis_data": None,
        "failure_reason": last_error
    }

def run_thesis_statement_charateristics_with_retries(
        essay,
        essay_id,
        thesis_statement,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        max_attempts = MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="thesis_statement_characteristics"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        try:
            ts_characteristics, elapsed_ms, emissions_kg = call_with_timer_ms(
                thesis_statement_characteristics,
                essay,
                "experiments/tasks_thesis/essay_knowledge_determine_thesis.md",
                thesis_statement,
                "experiments/tasks_thesis/essay_characterize_thesis.md",
                base_url,
                max_tokens,
                temp,
                sampling_params
            )

            ts_characteristics_data = ts_characteristics["choices"][0]["message"]["content"]
            ts_characteristics_data = json.loads(ts_characteristics_data)
            validated = validate_thesis_statement_characteristics_shape(ts_characteristics_data)

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
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "thesis_data": validated,
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
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
            )
    return {
        "passed": False,
        "attempts_used": max_attempts,
        "thesis_data": None,
        "failure_reason": last_error
    }

def run_thesis_statement_advice_with_retries(
        essay,
        essay_id,
        thesis_statement,
        no_characteristics_count,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        max_attempts = MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="thesis_statement_advice"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        try:
            ts_advice, elapsed_ms, emissions_kg = call_with_timer_ms(
                thesis_statement_advice,
                essay,
                "experiments/tasks_thesis/essay_knowledge_thesis_characteristics.md",
                thesis_statement,
                no_characteristics_count,
                "experiments/tasks_thesis/essay_thesis_statement_advice.md",
                base_url,
                max_tokens,
                temp,
                sampling_params
            )

            ts_advice_data = ts_advice["choices"][0]["message"]["content"]
            ts_advice_data = json.loads(ts_advice_data)
            validated = validate_thesis_statement_advice_shape(ts_advice_data)

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
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "thesis_data": validated,
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
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
            )
    return {
        "passed": False,
        "attempts_used": max_attempts,
        "thesis_data": None,
        "failure_reason": last_error
    }

def run_thesis_statement_comment_with_retries(
        essay,
        essay_id,
        thesis_statement,
        what_is_missing,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        max_attempts = MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="thesis_statement_comment"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        try:
            ts_advice, elapsed_ms, emissions_kg = call_with_timer_ms(
                thesis_statement_comment,
                essay,
                "experiments/tasks_thesis/essay_knowledge_thesis_characteristics.md",
                thesis_statement,
                what_is_missing,
                "experiments/tasks_thesis/essay_thesis_statement_comment.md",
                base_url,
                max_tokens,
                temp,
                sampling_params
            )

            ts_comment = ts_advice["choices"][0]["message"]["content"]
            ts_comment_data = json.loads(ts_comment)
            validated = validate_thesis_statement_comment(ts_comment_data)

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
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "thesis_data": validated,
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
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
            )
    return {
        "passed": False,
        "attempts_used": max_attempts,
        "thesis_data": None,
        "failure_reason": last_error
    }

def run_thesis_statement_heap_praise_with_retries(
        essay,
        essay_id,
        thesis_statement,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        sampling_params,
        max_attempts = MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="thesis_statement_heap_praise"

    for attempt in range(1, max_attempts + 1):
        elapsed_ms = 0
        emissions_kg = None
        try:
            ts_advice, elapsed_ms, emissions_kg = call_with_timer_ms(
                thesis_statement_heap_praise,
                essay,
                "experiments/tasks_thesis/essay_knowledge_thesis_characteristics.md",
                thesis_statement,
                "experiments/tasks_thesis/essay_thesis_statement_heap_praise.md",
                base_url,
                max_tokens,
                temp,
                sampling_params
            )

            ts_praise = ts_advice["choices"][0]["message"]["content"]
            ts_praise_data = json.loads(ts_praise)
            validated = validate_thesis_statement_heap_praise(ts_praise_data)

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
            )

            return {
                "passed": True,
                "attempts_used": attempt,
                "thesis_data": validated,
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
                attempt_count=attempt,
                passed=False,
                failure_reason=last_error,
                benchmark_type=BENCHMARK_TYPE,
                elapsed_ms=elapsed_ms,
                emissions_kg=emissions_kg,
            )
    return {
        "passed": False,
        "attempts_used": max_attempts,
        "thesis_data": None,
        "failure_reason": last_error
    }

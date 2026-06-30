import json
from attempts_logs import append_attempt_log
from validators.validate_grammar import validate_edit_for_style, validate_repair_grammar
from essay_analysis_grammar import edit_for_style, repair_grammar
MAX_ATTEMPTS = 6

def run_edit_for_style_with_retries(
        bp,
        essay_id,
        para_num,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="grammar_edit_for_style"

    for attempt in range(1, max_attempts + 1):
        try:
            edits = edit_for_style(
                bp,
                "experiments/tasks_grammar/style_knowledge.md",
                "experiments/tasks_grammar/improve_style.md",
                base_url,
                max_tokens,
                temp
            )

            edits_data = edits["choices"][0]["message"]["content"]
            edits_data = json.loads(edits_data)
            validated = validate_edit_for_style(edits_data)

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
                "grammar_data": validated,
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
        "grammar_data": None,
        "failure_reason": last_error
    }

def run_repair_grammar_with_retries(
        bp,
        essay_id,
        para_num,
        base_url,
        max_tokens,
        temp,
        csv_file_append,
        max_attempts=MAX_ATTEMPTS
):
    last_error = None
    BENCHMARK_TYPE="repair_grammar"

    for attempt in range(1, max_attempts + 1):
        try:
            edits = edit_for_style(
                bp,
                "experiments/tasks_grammar/grammar_knowledge.md",
                "experiments/tasks_grammar/improve_language.md",
                base_url,
                max_tokens,
                temp
            )

            edits_data = edits["choices"][0]["message"]["content"]
            edits_data = json.loads(edits_data)
            validated = validate_repair_grammar(edits_data)

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
                "grammar_data": validated,
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
        "grammar_data": None,
        "failure_reason": last_error
    }